import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  decideMentor,
  getStudent,
  listStudents,
  setAccountActive,
  updateStudent,
} from "@/lib/admin/people";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/query";
import { assignMentor, createTechStack, listAuditLogs } from "@/lib/admin/workflow";
import { authenticate } from "@/lib/auth/accounts";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

const domain = "@admin-dash.test";

function id() {
  return randomUUID().slice(0, 8);
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { endsWith: domain } },
    select: { id: true, studentProfile: { select: { id: true } }, mentorProfile: { select: { id: true } } },
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
  await db.techStack.deleteMany({ where: { name: { startsWith: "admin-test-" } } });
}

afterEach(cleanup);

async function person(
  role: "STUDENT" | "MENTOR" | "ADMIN",
  suffix: string,
  label: string,
  extra?: { deactivatedAt?: Date; passwordHash?: string },
) {
  return db.user.create({
    data: {
      role,
      firstName: label,
      lastName: "Person",
      email: `${label}-${suffix}${domain}`,
      passwordHash: extra?.passwordHash ?? "stored-hash-not-for-the-client",
      deactivatedAt: extra?.deactivatedAt,
      ...(role === "STUDENT"
        ? {
            studentProfile: {
              create: { niatId: `niat-${label}-${suffix}`, batch: "Batch 24", universityName: "Example University" },
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
              },
            },
          }
        : {}),
    },
    include: { studentProfile: true, mentorProfile: true },
  });
}

describe("admin authorization", () => {
  it("rejects students, mentors, missing users, and deactivated admins", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor");
    const deactivated = await person("ADMIN", suffix, "retired", { deactivatedAt: new Date() });
    const profile = {
      firstName: "Ada",
      lastName: "Lovelace",
      batch: "Batch 24",
      universityName: "Example University",
    };

    for (const actorId of [student.id, mentor.id, deactivated.id]) {
      expect((await listStudents(actorId, { page: 1, search: "", account: "all" })).ok).toBe(false);
      expect((await updateStudent(actorId, student.id, profile)).ok).toBe(false);
      expect((await decideMentor(actorId, mentor.id, "APPROVED")).ok).toBe(false);
      expect((await createTechStack(actorId, `admin-test-${suffix}`)).ok).toBe(false);
      expect((await listAuditLogs(actorId, { page: 1, search: "" })).ok).toBe(false);
    }

    const missing = await listStudents(randomUUID(), { page: 1, search: "", account: "all" });
    expect(missing).toMatchObject({ ok: false, code: "unauthenticated" });

    const studentView = await getStudent(student.id, student.id);
    expect(studentView).toMatchObject({ ok: false, code: "forbidden" });

    const self = await setAccountActive(admin.id, admin.id, false);
    expect(self).toMatchObject({ ok: false, code: "invalid" });
    expect(JSON.stringify({ missing, studentView, self })).not.toContain("stored-hash-not-for-the-client");
  });

  it("updates and deactivates only the targeted student", async () => {
    const suffix = id();
    const password = "Sup3r-secret!";
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student", { passwordHash: await hashPassword(password) });
    await db.session.create({
      data: {
        userId: student.id,
        tokenHash: `admin-session-${suffix}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const updated = await updateStudent(admin.id, student.id, {
      firstName: "Ada",
      lastName: "Lovelace",
      batch: "Batch 25",
      universityName: "Updated University",
    });
    expect(updated.ok).toBe(true);

    const row = await db.user.findUnique({
      where: { id: student.id },
      include: { studentProfile: true },
    });
    expect(row?.studentProfile).toMatchObject({ batch: "Batch 25", universityName: "Updated University" });
    expect(row?.firstName).toBe("Ada");

    const audit = await db.auditLog.findFirst({
      where: { actorId: admin.id, targetId: student.id, action: "STUDENT_UPDATED" },
    });
    expect(audit?.targetType).toBe("USER");

    const mentor = await person("MENTOR", suffix, "other");
    expect((await getStudent(admin.id, mentor.id)).ok).toBe(false);

    const deactivated = await setAccountActive(admin.id, student.id, false);
    expect(deactivated.ok).toBe(true);
    await expect(db.session.count({ where: { userId: student.id } })).resolves.toBe(0);
    await expect(authenticate(student.email, password)).resolves.toMatchObject({
      ok: false,
      formError: "This account is deactivated.",
    });
    const deactivation = await db.auditLog.findFirst({
      where: { targetId: student.id, action: "USER_DEACTIVATED" },
    });
    expect(deactivation?.actorId).toBe(admin.id);
  });

  it("assigns only an approved mentor for the submission tech stack", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor");
    const other = await person("MENTOR", suffix, "other");
    const stack = await db.techStack.create({ data: { name: `admin-test-${suffix}` } });
    const profileId = student.studentProfile?.id;
    const mentorProfileId = mentor.mentorProfile?.id;
    const otherProfileId = other.mentorProfile?.id;
    if (!profileId || !mentorProfileId || !otherProfileId) {
      throw new Error("profiles missing");
    }

    const submission = await db.pRSubmission.create({
      data: {
        studentId: profileId,
        githubPrUrl: `https://github.com/example/admin/pull/${suffix}`,
        repository: "example/admin",
        techStackId: stack.id,
        status: "PENDING",
      },
    });

    const pending = await assignMentor(admin.id, submission.id, mentorProfileId);
    expect(pending).toMatchObject({ ok: false, code: "invalid" });

    await decideMentor(admin.id, mentor.id, "APPROVED");
    const unmatched = await assignMentor(admin.id, submission.id, mentorProfileId);
    expect(unmatched).toMatchObject({ ok: false, code: "invalid" });
    await expect(db.mentorAssignment.count({ where: { prSubmissionId: submission.id } })).resolves.toBe(0);

    await db.mentorTechStack.create({ data: { mentorId: mentorProfileId, techStackId: stack.id } });
    const assigned = await assignMentor(admin.id, submission.id, mentorProfileId);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    const assignment = await db.mentorAssignment.findUnique({ where: { id: assigned.data.assignmentId } });
    expect(assignment).toMatchObject({
      studentId: profileId,
      mentorId: mentorProfileId,
      assignedById: admin.id,
      status: "ACTIVE",
    });
    await expect(db.pRSubmission.findUnique({ where: { id: submission.id } })).resolves.toMatchObject({
      status: "ASSIGNED",
    });
    const audit = await db.auditLog.findFirst({
      where: { targetId: assigned.data.assignmentId, action: "MENTOR_ASSIGNED" },
    });
    expect(audit?.actorId).toBe(admin.id);

    await decideMentor(admin.id, other.id, "APPROVED");
    await db.mentorTechStack.create({ data: { mentorId: otherProfileId, techStackId: stack.id } });
    const reassigned = await assignMentor(admin.id, submission.id, otherProfileId);
    expect(reassigned.ok).toBe(true);
    await expect(
      db.mentorAssignment.findFirst({ where: { prSubmissionId: submission.id, mentorId: mentorProfileId } }),
    ).resolves.toMatchObject({ status: "REASSIGNED" });
    await expect(
      db.mentorAssignment.count({ where: { prSubmissionId: submission.id, status: "ACTIVE" } }),
    ).resolves.toBe(1);
    expect(
      await db.auditLog.findFirst({
        where: { actorId: admin.id, action: "MENTOR_REASSIGNED" },
      }),
    ).not.toBeNull();

    const studentAttempt = await assignMentor(student.id, submission.id, mentorProfileId);
    expect(studentAttempt).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("pages student search results instead of returning every row", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const batch = `admin-page-${suffix}`;
    await Promise.all(
      Array.from({ length: ADMIN_PAGE_SIZE + 1 }, (_, index) =>
        db.user.create({
          data: {
            role: "STUDENT",
            firstName: "Page",
            lastName: String(index).padStart(2, "0"),
            email: `page-${index}-${suffix}${domain}`,
            passwordHash: "stored-hash-not-for-the-client",
            studentProfile: {
              create: {
                niatId: `page-${index}-${suffix}`,
                batch,
                universityName: "Example University",
              },
            },
          },
        }),
      ),
    );

    const first = await listStudents(admin.id, { page: 1, search: batch, account: "all" });
    const second = await listStudents(admin.id, { page: 2, search: batch, account: "all" });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(first.data.total).toBe(ADMIN_PAGE_SIZE + 1);
    expect(first.data.items).toHaveLength(ADMIN_PAGE_SIZE);
    expect(second.data.items).toHaveLength(1);
    const firstIds = new Set(first.data.items.map((item) => item.id));
    expect(second.data.items.some((item) => firstIds.has(item.id))).toBe(false);
  });
});
