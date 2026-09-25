import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { decideMentor, listStudents, setAccountActive, updateStudent } from "@/lib/admin/people";
import { assignMentor, createTechStack, listAuditLogs } from "@/lib/admin/workflow";
import { listChats, sendMessage } from "@/lib/mentor/chat";
import {
  getAssignedStudent,
  listAssignedPullRequests,
  listAssignedStudents,
  listPendingReviews,
} from "@/lib/mentor/directory";
import { MENTOR_PAGE_SIZE } from "@/lib/mentor/query";
import { getPullRequest, postReview, startReview } from "@/lib/mentor/reviews";
import { db } from "@/lib/db";

const domain = "@mentor-exp.test";

function id() {
  return randomUUID().slice(0, 8);
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { endsWith: domain } },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  const userIds = users.map((user) => user.id);
  const profileIds = users.flatMap((user) => (user.studentProfile ? [user.studentProfile.id] : []));

  if (profileIds.length > 0) {
    const submissions = await db.pRSubmission.findMany({
      where: { studentId: { in: profileIds } },
      select: { id: true },
    });
    const submissionIds = submissions.map((submission) => submission.id);
    if (submissionIds.length > 0) {
      await db.notification.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.message.deleteMany({ where: { conversation: { prSubmissionId: { in: submissionIds } } } });
      await db.conversationParticipant.deleteMany({
        where: { conversation: { prSubmissionId: { in: submissionIds } } },
      });
      await db.conversation.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.pRReview.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.auditLog.deleteMany({ where: { targetId: { in: submissionIds } } });
      await db.mentorAssignment.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.pRSubmission.deleteMany({ where: { id: { in: submissionIds } } });
    }
  }

  if (userIds.length > 0) {
    await db.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
  }

  await db.user.deleteMany({ where: { email: { endsWith: domain } } });
  await db.techStack.deleteMany({ where: { name: { startsWith: "mentor-test-" } } });
}

afterEach(cleanup);

async function person(role: "STUDENT" | "MENTOR" | "ADMIN", suffix: string, label: string, deactivated = false) {
  return db.user.create({
    data: {
      role,
      firstName: label,
      lastName: "Person",
      email: `${label}-${suffix}${domain}`,
      passwordHash: "stored-hash-not-for-the-client",
      deactivatedAt: deactivated ? new Date() : null,
      ...(role === "STUDENT"
        ? {
            studentProfile: {
              create: {
                niatId: `niat-${label}-${suffix}`,
                batch: `${label}-batch`,
                universityName: "Example University",
              },
            },
          }
        : {}),
      ...(role === "MENTOR"
        ? {
            mentorProfile: {
              create: {
                employeeId: `emp-${label}-${suffix}`,
                batch: "Batch 24",
                universityName: "Example University",
                approvalStatus: "APPROVED",
              },
            },
          }
        : {}),
    },
    include: { studentProfile: true, mentorProfile: true },
  });
}

async function assignedPull(suffix: string, repository: string, status: "ASSIGNED" | "CLOSED" = "ASSIGNED") {
  const admin = await person("ADMIN", suffix, `admin-${repository}`);
  const mentor = await person("MENTOR", suffix, `mentor-${repository}`);
  const student = await person("STUDENT", suffix, `student-${repository}`);
  const stack = await db.techStack.create({ data: { name: `mentor-test-${repository}-${suffix}` } });
  const submission = await db.pRSubmission.create({
    data: {
      studentId: student.studentProfile!.id,
      githubPrUrl: `https://github.com/${repository}-${suffix}/app/pull/1`,
      repository: `${repository}-${suffix}/app`,
      techStackId: stack.id,
      status,
    },
  });
  await db.mentorAssignment.create({
    data: {
      prSubmissionId: submission.id,
      studentId: student.studentProfile!.id,
      mentorId: mentor.mentorProfile!.id,
      assignedById: admin.id,
      status: "ACTIVE",
    },
  });
  return { admin, mentor, student, stack, submission };
}

describe("mentor authorization", () => {
  it("rejects students, admins, deactivated mentors, and missing users", async () => {
    const suffix = id();
    const world = await assignedPull(suffix, "owned");
    const student = world.student;
    const admin = world.admin;
    const retired = await person("MENTOR", suffix, "retired", true);
    const profile = {
      firstName: "Ada",
      lastName: "Lovelace",
      batch: "Batch 24",
      universityName: "Example University",
    };

    for (const actorId of [student.id, admin.id, retired.id, randomUUID()]) {
      expect((await listAssignedPullRequests(actorId, { page: 1, search: "", status: "all", techStackId: null })).ok).toBe(
        false,
      );
      expect((await getAssignedStudent(actorId, student.id)).ok).toBe(false);
      expect((await getPullRequest(actorId, world.submission.id)).ok).toBe(false);
      expect((await postReview(actorId, world.submission.id, { decision: "APPROVED", comment: "No." })).ok).toBe(false);
      expect((await startReview(actorId, world.submission.id)).ok).toBe(false);
      expect((await sendMessage(actorId, world.submission.id, "Hello")).ok).toBe(false);
    }

    const missing = await listAssignedStudents(randomUUID(), { page: 1, search: "" });
    expect(missing).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(JSON.stringify(missing)).not.toContain("stored-hash-not-for-the-client");
    expect(await db.pRReview.count({ where: { prSubmissionId: world.submission.id } })).toBe(0);
  });

  it("does not grant admin operations to a mentor", async () => {
    const suffix = id();
    const mentor = await person("MENTOR", suffix, "mentor");
    const student = await person("STUDENT", suffix, "student");
    const stackName = `mentor-test-admin-${suffix}`;

    expect((await listStudents(mentor.id, { page: 1, search: "", account: "all" })).ok).toBe(false);
    expect((await listAuditLogs(mentor.id, { page: 1, search: "" })).ok).toBe(false);
    expect((await decideMentor(mentor.id, mentor.id, "APPROVED")).ok).toBe(false);
    expect((await createTechStack(mentor.id, stackName)).ok).toBe(false);
    expect((await assignMentor(mentor.id, randomUUID(), mentor.mentorProfile!.id)).ok).toBe(false);
    expect((await setAccountActive(mentor.id, student.id, false)).ok).toBe(false);
    expect(
      (
        await updateStudent(mentor.id, student.id, {
          firstName: "Changed",
          lastName: "Name",
          batch: "Batch 99",
          universityName: "Other",
        })
      ).ok,
    ).toBe(false);

    const unchanged = await db.user.findUnique({ where: { id: student.id }, select: { firstName: true, role: true, deactivatedAt: true } });
    expect(unchanged).toMatchObject({ firstName: "student", role: "STUDENT", deactivatedAt: null });
    expect(await db.techStack.count({ where: { name: stackName } })).toBe(0);
    const mentorRow = await db.user.findUnique({ where: { id: mentor.id }, select: { role: true } });
    expect(mentorRow?.role).toBe("MENTOR");
  });

  it("hides students and pull requests assigned to someone else", async () => {
    const suffix = id();
    const mine = await assignedPull(suffix, "mine");
    const theirs = await assignedPull(suffix, "theirs");

    const pulls = await listAssignedPullRequests(mine.mentor.id, {
      page: 1,
      search: "",
      status: "all",
      techStackId: null,
    });
    expect(pulls.ok).toBe(true);
    if (pulls.ok) {
      expect(pulls.data.items.map((item) => item.submissionId)).toEqual([mine.submission.id]);
      expect(JSON.stringify(pulls.data)).not.toContain(theirs.submission.repository);
    }

    const students = await listAssignedStudents(mine.mentor.id, { page: 1, search: "" });
    expect(students.ok).toBe(true);
    if (students.ok) {
      expect(students.data.items.map((item) => item.userId)).toEqual([mine.student.id]);
    }

    const foreignStudent = await getAssignedStudent(mine.mentor.id, theirs.student.id);
    const foreignPull = await getPullRequest(mine.mentor.id, theirs.submission.id);
    expect(foreignStudent).toMatchObject({ ok: false, code: "forbidden" });
    expect(foreignPull).toMatchObject({ ok: false, code: "forbidden" });
    expect(JSON.stringify({ foreignStudent, foreignPull })).not.toContain(theirs.submission.repository);
    expect(JSON.stringify({ foreignStudent, foreignPull })).not.toContain("stored-hash-not-for-the-client");

    const review = await postReview(mine.mentor.id, theirs.submission.id, {
      decision: "APPROVED",
      comment: "Not my pull request",
    });
    expect(review).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.pRReview.count({ where: { prSubmissionId: theirs.submission.id } })).toBe(0);
  });

  it("refuses a review after the assignment is no longer active", async () => {
    const suffix = id();
    const world = await assignedPull(suffix, "moved");
    await db.mentorAssignment.updateMany({
      where: { prSubmissionId: world.submission.id },
      data: { status: "REASSIGNED" },
    });

    const review = await postReview(world.mentor.id, world.submission.id, {
      decision: "APPROVED",
      comment: "Too late",
    });
    expect(review).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.pRReview.count({ where: { prSubmissionId: world.submission.id } })).toBe(0);
  });
});

describe("mentor review workflow", () => {
  it("starts a review, records a decision, and keeps the comment out of the audit log", async () => {
    const suffix = id();
    const world = await assignedPull(suffix, "review");
    const comment = "Please rename the helper.";

    const started = await startReview(world.mentor.id, world.submission.id);
    expect(started.ok).toBe(true);
    const again = await startReview(world.mentor.id, world.submission.id);
    expect(again.ok).toBe(true);

    const row = await db.pRSubmission.findUnique({ where: { id: world.submission.id } });
    expect(row?.status).toBe("IN_REVIEW");
    expect(await db.auditLog.count({ where: { actorId: world.mentor.id, action: "REVIEW_STARTED" } })).toBe(1);

    const posted = await postReview(world.mentor.id, world.submission.id, {
      decision: "CHANGES_REQUESTED",
      comment,
      role: "ADMIN",
    });
    expect(posted.ok).toBe(true);

    const updated = await db.pRSubmission.findUnique({ where: { id: world.submission.id } });
    expect(updated).toMatchObject({ status: "CHANGES_REQUESTED", reviewState: "CHANGES_REQUESTED" });
    const review = await db.pRReview.findFirst({ where: { prSubmissionId: world.submission.id } });
    expect(review).toMatchObject({ comment, decision: "CHANGES_REQUESTED", mentorId: world.mentor.mentorProfile!.id });
    const audit = await db.auditLog.findFirst({ where: { actorId: world.mentor.id, action: "REVIEW_POSTED" } });
    expect(audit?.detail).not.toContain(comment);
    const notice = await db.notification.findFirst({
      where: { recipientId: world.student.id, type: "REVIEW_POSTED", prSubmissionId: world.submission.id },
    });
    expect(notice).not.toBeNull();

    const pending = await listPendingReviews(world.mentor.id, { page: 1 });
    expect(pending.ok).toBe(true);
    if (pending.ok) {
      expect(pending.data.items).toHaveLength(0);
    }

    const mentorRow = await db.user.findUnique({ where: { id: world.mentor.id }, select: { role: true } });
    expect(mentorRow?.role).toBe("MENTOR");
  });

  it("rejects a closed submission and a decision outside the review choices", async () => {
    const suffix = id();
    const world = await assignedPull(suffix, "closed", "CLOSED");

    const rejected = await postReview(world.mentor.id, world.submission.id, {
      decision: "REJECTED",
      comment: "Close it",
    });
    expect(rejected.ok).toBe(false);
    const closed = await postReview(world.mentor.id, world.submission.id, {
      decision: "APPROVED",
      comment: "Looks good",
    });
    expect(closed).toMatchObject({ ok: false, code: "invalid" });
    expect(await db.pRReview.count({ where: { prSubmissionId: world.submission.id } })).toBe(0);
    const row = await db.pRSubmission.findUnique({ where: { id: world.submission.id } });
    expect(row?.status).toBe("CLOSED");
  });

  it("sends a message only to the assigned student", async () => {
    const suffix = id();
    const world = await assignedPull(suffix, "chat");
    const other = await person("STUDENT", suffix, "other");
    const body = "secret-mentor-note";

    const sent = await sendMessage(world.mentor.id, world.submission.id, `  ${body}  `);
    expect(sent.ok).toBe(true);

    const conversation = await db.conversation.findUnique({
      where: { prSubmissionId: world.submission.id },
      include: { participants: true, messages: true },
    });
    expect(conversation?.messages[0]?.body).not.toContain(body);
    expect(conversation?.messages[0]?.body.startsWith("v1.")).toBe(true);
    expect(conversation?.messages[0]?.senderId).toBe(world.mentor.id);
    expect(conversation?.participants.map((participant) => participant.userId).sort()).toEqual(
      [world.mentor.id, world.student.id].sort(),
    );
    expect(conversation?.participants.some((participant) => participant.userId === other.id)).toBe(false);

    const audit = await db.auditLog.findFirst({ where: { actorId: world.mentor.id, action: "MESSAGE_SENT" } });
    expect(audit?.detail).not.toContain(body);
    const chats = await listChats(world.mentor.id, { page: 1 });
    expect(chats.ok).toBe(true);
    if (chats.ok) {
      expect(chats.data.items[0]?.messages[0]?.body).toBe(body);
    }
  });

  it("pages assigned pull requests without including another mentor's work", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const mentor = await person("MENTOR", suffix, "mentor");
    const other = await person("MENTOR", suffix, "other");
    const student = await person("STUDENT", suffix, "student");
    const foreign = await person("STUDENT", suffix, "foreign");
    const stack = await db.techStack.create({ data: { name: `mentor-test-page-${suffix}` } });

    for (let index = 0; index < MENTOR_PAGE_SIZE + 1; index += 1) {
      const submission = await db.pRSubmission.create({
        data: {
          studentId: student.studentProfile!.id,
          githubPrUrl: `https://github.com/page-${suffix}/app/pull/${index + 1}`,
          repository: `page-${suffix}/app`,
          techStackId: stack.id,
          status: "ASSIGNED",
          submittedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        },
      });
      await db.mentorAssignment.create({
        data: {
          prSubmissionId: submission.id,
          studentId: student.studentProfile!.id,
          mentorId: mentor.mentorProfile!.id,
          assignedById: admin.id,
        },
      });
    }

    const foreignSubmission = await db.pRSubmission.create({
      data: {
        studentId: foreign.studentProfile!.id,
        githubPrUrl: `https://github.com/foreign-${suffix}/app/pull/1`,
        repository: `foreign-${suffix}/app`,
        techStackId: stack.id,
        status: "ASSIGNED",
      },
    });
    await db.mentorAssignment.create({
      data: {
        prSubmissionId: foreignSubmission.id,
        studentId: foreign.studentProfile!.id,
        mentorId: other.mentorProfile!.id,
        assignedById: admin.id,
      },
    });

    const first = await listAssignedPullRequests(mentor.id, { page: 1, search: "", status: "all", techStackId: null });
    const second = await listAssignedPullRequests(mentor.id, { page: 2, search: "", status: "all", techStackId: null });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.data.items).toHaveLength(MENTOR_PAGE_SIZE);
      expect(second.data.items).toHaveLength(1);
      expect(first.data.total).toBe(MENTOR_PAGE_SIZE + 1);
      const ids = [...first.data.items, ...second.data.items].map((item) => item.submissionId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(foreignSubmission.id);
      expect(JSON.stringify({ first: first.data, second: second.data })).not.toContain(`foreign-${suffix}/app`);
    }
  });
});
