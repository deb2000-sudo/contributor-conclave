import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import { db } from "@/lib/db";
import { MESSAGE_PAGE_SIZE, MESSAGE_RATE_LIMIT } from "@/lib/messaging/policy";
import { messagingService } from "@/lib/messaging/service";

const domain = "@messaging.test";

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
  await db.techStack.deleteMany({ where: { name: { startsWith: "message-test-" } } });
}

afterEach(cleanup);

async function person(
  role: "STUDENT" | "MENTOR" | "ADMIN",
  suffix: string,
  label: string,
  approval: "PENDING" | "APPROVED" = "APPROVED",
) {
  return db.user.create({
    data: {
      role,
      firstName: label,
      lastName: "Person",
      email: `${label}-${suffix}${domain}`,
      passwordHash: "stored-hash-not-for-the-client",
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
                approvalStatus: approval,
              },
            },
          }
        : {}),
    },
    include: { studentProfile: true, mentorProfile: true },
  });
}

describe("messagingService", () => {
  it("opens a conversation on assignment and keeps the text between that student and mentor", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor");
    const otherMentor = await person("MENTOR", suffix, "other");
    const outsider = await person("STUDENT", suffix, "outsider");
    const stack = await db.techStack.create({ data: { name: `message-test-${suffix}` } });
    const studentProfileId = student.studentProfile?.id;
    const mentorProfileId = mentor.mentorProfile?.id;
    const otherProfileId = otherMentor.mentorProfile?.id;
    if (!studentProfileId || !mentorProfileId || !otherProfileId) {
      throw new Error("profiles missing");
    }

    await db.mentorTechStack.createMany({
      data: [
        { mentorId: mentorProfileId, techStackId: stack.id },
        { mentorId: otherProfileId, techStackId: stack.id },
      ],
    });
    const submission = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/message-${suffix}/app/pull/1`,
        repository: `message-${suffix}/app`,
        techStackId: stack.id,
        status: "PENDING",
      },
    });

    const assigned = await mentorAssignmentService.assign(admin.id, submission.id, mentorProfileId);
    expect(assigned.ok).toBe(true);

    const conversation = await db.conversation.findUnique({
      where: { prSubmissionId: submission.id },
      include: { participants: true },
    });
    expect(conversation?.participants.map((participant) => participant.userId).sort()).toEqual(
      [mentor.id, student.id].sort(),
    );

    const body = `private-note-${suffix}`;
    const sent = await messagingService.send(student.id, submission.id, `  ${body}  `);
    expect(sent.ok).toBe(true);

    const stored = await db.message.findFirst({ where: { conversationId: conversation?.id } });
    expect(stored?.body.startsWith("v1.")).toBe(true);
    expect(stored?.body).not.toContain(body);
    expect(stored?.status).toBe("SENT");

    const mentorList = await messagingService.listConversations(mentor.id, 1);
    expect(mentorList.ok).toBe(true);
    if (mentorList.ok) {
      expect(mentorList.data.items[0]?.unreadCount).toBe(1);
      expect(mentorList.data.items[0]?.latestText).toContain(body);
    }

    const read = await messagingService.getConversation(mentor.id, submission.id, null);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.data.messages[0]?.text).toBe(body);
      expect(read.data.messages.map((message) => message.text).join(" ")).not.toContain("v1.");
    }
    await expect(db.message.findFirst({ where: { id: stored?.id } })).resolves.toMatchObject({ status: "READ" });
    const afterRead = await messagingService.listConversations(mentor.id, 1);
    expect(afterRead.ok && afterRead.data.items[0]?.unreadCount).toBe(0);

    const studentView = await messagingService.getConversation(student.id, submission.id, null);
    expect(studentView.ok).toBe(true);
    if (studentView.ok) {
      expect(studentView.data.messages[0]).toMatchObject({ text: body, status: "READ", own: true });
    }

    const adminView = await messagingService.getConversation(admin.id, submission.id, null);
    const outsiderView = await messagingService.getConversation(outsider.id, submission.id, null);
    expect(adminView).toMatchObject({ ok: false, code: "forbidden" });
    expect(outsiderView).toMatchObject({ ok: false, code: "forbidden" });
    expect(JSON.stringify({ adminView, outsiderView })).not.toContain(body);
    expect(JSON.stringify({ adminView, outsiderView })).not.toContain("stored-hash-not-for-the-client");

    const reassigned = await mentorAssignmentService.assign(admin.id, submission.id, otherProfileId);
    expect(reassigned.ok).toBe(true);
    const members = await db.conversationParticipant.findMany({ where: { conversationId: conversation?.id } });
    expect(members.map((member) => member.userId).sort()).toEqual([otherMentor.id, student.id].sort());
    expect(await messagingService.getConversation(mentor.id, submission.id, null)).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    const nextMentor = await messagingService.getConversation(otherMentor.id, submission.id, null);
    expect(nextMentor.ok).toBe(true);
    if (nextMentor.ok) {
      expect(nextMentor.data.messages[0]?.text).toBe(body);
    }
  });

  it("pages messages and refuses a cursor from another conversation", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor");
    const stack = await db.techStack.create({ data: { name: `message-test-page-${suffix}` } });
    const studentProfileId = student.studentProfile?.id;
    const mentorProfileId = mentor.mentorProfile?.id;
    if (!studentProfileId || !mentorProfileId) {
      throw new Error("profiles missing");
    }
    await db.mentorTechStack.create({ data: { mentorId: mentorProfileId, techStackId: stack.id } });
    const submission = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/message-${suffix}/page/pull/1`,
        repository: `message-${suffix}/page`,
        techStackId: stack.id,
        status: "PENDING",
      },
    });
    await mentorAssignmentService.assign(admin.id, submission.id, mentorProfileId);
    const conversation = await db.conversation.findUniqueOrThrow({ where: { prSubmissionId: submission.id } });

    const other = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/message-${suffix}/other/pull/1`,
        repository: `message-${suffix}/other`,
        techStackId: stack.id,
        status: "ASSIGNED",
      },
    });
    const otherConversation = await db.conversation.create({ data: { prSubmissionId: other.id } });
    const foreign = await db.message.create({
      data: {
        conversationId: otherConversation.id,
        senderId: student.id,
        body: `foreign-secret-${suffix}`,
        createdAt: new Date(Date.UTC(2026, 0, 2)),
      },
    });

    for (let index = 0; index < MESSAGE_PAGE_SIZE + 1; index += 1) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: index % 2 === 0 ? student.id : mentor.id,
          body: `note-${index}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        },
      });
    }

    const first = await messagingService.getConversation(student.id, submission.id, null);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.data.messages).toHaveLength(MESSAGE_PAGE_SIZE);
    expect(first.data.olderCursor).toBeTruthy();
    expect(first.data.messages.some((message) => message.text.includes("foreign-secret"))).toBe(false);

    const older = await messagingService.getConversation(student.id, submission.id, first.data.olderCursor);
    expect(older.ok).toBe(true);
    if (!older.ok) {
      return;
    }
    expect(older.data.messages).toHaveLength(1);
    const seen = new Set([...first.data.messages, ...older.data.messages].map((message) => message.id));
    expect(seen.size).toBe(MESSAGE_PAGE_SIZE + 1);
    expect(seen.has(foreign.id)).toBe(false);

    const wrongCursor = await messagingService.getConversation(student.id, submission.id, foreign.id);
    expect(wrongCursor.ok).toBe(true);
    if (wrongCursor.ok) {
      expect(wrongCursor.data.messages.some((message) => message.id === foreign.id)).toBe(false);
      expect(JSON.stringify(wrongCursor.data)).not.toContain(`foreign-secret-${suffix}`);
    }
  });

  it("stops a sender who exceeds the message limit", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor");
    const stack = await db.techStack.create({ data: { name: `message-test-rate-${suffix}` } });
    const studentProfileId = student.studentProfile?.id;
    const mentorProfileId = mentor.mentorProfile?.id;
    if (!studentProfileId || !mentorProfileId) {
      throw new Error("profiles missing");
    }
    await db.mentorTechStack.create({ data: { mentorId: mentorProfileId, techStackId: stack.id } });
    const submission = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/message-${suffix}/rate/pull/1`,
        repository: `message-${suffix}/rate`,
        techStackId: stack.id,
        status: "PENDING",
      },
    });
    await mentorAssignmentService.assign(admin.id, submission.id, mentorProfileId);
    const conversation = await db.conversation.findUniqueOrThrow({ where: { prSubmissionId: submission.id } });

    await db.message.createMany({
      data: Array.from({ length: MESSAGE_RATE_LIMIT }, (_, index) => ({
        conversationId: conversation.id,
        senderId: student.id,
        body: `burst-${index}`,
      })),
    });

    const limited = await messagingService.send(student.id, submission.id, "one more");
    expect(limited).toMatchObject({ ok: false, code: "limited" });
    await expect(db.message.count({ where: { conversationId: conversation.id } })).resolves.toBe(MESSAGE_RATE_LIMIT);
  });
});
