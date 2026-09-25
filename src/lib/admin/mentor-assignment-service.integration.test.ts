import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import { db } from "@/lib/db";

const domain = "@assign-service.test";

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
  await db.techStack.deleteMany({ where: { name: { startsWith: "assign-test-" } } });
}

afterEach(cleanup);

async function person(
  role: "STUDENT" | "MENTOR" | "ADMIN",
  suffix: string,
  label: string,
  options?: { approval?: "PENDING" | "APPROVED" | "REJECTED"; deactivatedAt?: Date; lastName?: string },
) {
  return db.user.create({
    data: {
      role,
      firstName: label,
      lastName: options?.lastName ?? "Person",
      email: `${label}-${suffix}${domain}`,
      passwordHash: "stored-hash-not-for-the-client",
      deactivatedAt: options?.deactivatedAt,
      ...(role === "STUDENT"
        ? {
            studentProfile: {
              create: {
                niatId: `niat-${label}-${suffix}`,
                batch: "Batch 24",
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
                approvalStatus: options?.approval ?? "PENDING",
              },
            },
          }
        : {}),
    },
    include: { studentProfile: true, mentorProfile: true },
  });
}

describe("mentorAssignmentService", () => {
  it("lists active stack mentors by load and assigns only the mentor the admin selects", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const light = await person("MENTOR", suffix, "light", { approval: "APPROVED", lastName: "Zulu" });
    const busy = await person("MENTOR", suffix, "busy", { approval: "APPROVED", lastName: "Alpha" });
    const pending = await person("MENTOR", suffix, "pending");
    const rejected = await person("MENTOR", suffix, "rejected", { approval: "REJECTED" });
    const inactive = await person("MENTOR", suffix, "inactive", {
      approval: "APPROVED",
      deactivatedAt: new Date(),
    });
    const otherStackMentor = await person("MENTOR", suffix, "other", { approval: "APPROVED" });
    const stack = await db.techStack.create({ data: { name: `assign-test-${suffix}` } });
    const otherStack = await db.techStack.create({ data: { name: `assign-test-other-${suffix}` } });
    const studentProfileId = student.studentProfile?.id;
    const lightId = light.mentorProfile?.id;
    const busyId = busy.mentorProfile?.id;
    if (!studentProfileId || !lightId || !busyId || !pending.mentorProfile || !rejected.mentorProfile || !inactive.mentorProfile || !otherStackMentor.mentorProfile) {
      throw new Error("profiles missing");
    }

    for (const mentorId of [lightId, busyId, pending.mentorProfile.id, rejected.mentorProfile.id, inactive.mentorProfile.id]) {
      await db.mentorTechStack.create({ data: { mentorId, techStackId: stack.id } });
    }
    await db.mentorTechStack.create({
      data: { mentorId: otherStackMentor.mentorProfile.id, techStackId: otherStack.id },
    });

    for (const pull of [1, 2]) {
      const extra = await db.pRSubmission.create({
        data: {
          studentId: studentProfileId,
          githubPrUrl: `https://github.com/assign-${suffix}/load/pull/${pull}`,
          repository: `assign-${suffix}/load`,
          techStackId: stack.id,
          status: "ASSIGNED",
        },
      });
      await db.mentorAssignment.create({
        data: {
          prSubmissionId: extra.id,
          studentId: studentProfileId,
          mentorId: busyId,
          assignedById: admin.id,
        },
      });
    }

    const submission = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/assign-${suffix}/app/pull/1`,
        repository: `assign-${suffix}/app`,
        techStackId: stack.id,
        status: "PENDING",
      },
    });

    const listed = await mentorAssignmentService.listEligibleMentors(admin.id, submission.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.data.map((mentor) => mentor.id)).toEqual([lightId, busyId]);
    expect(listed.data.map((mentor) => mentor.activeAssignmentCount)).toEqual([0, 2]);
    expect(JSON.stringify(listed.data)).not.toContain("stored-hash-not-for-the-client");

    const assigned = await mentorAssignmentService.assign(admin.id, submission.id, busyId);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    const assignment = await db.mentorAssignment.findUnique({ where: { id: assigned.data.assignmentId } });
    expect(assignment).toMatchObject({
      mentorId: busyId,
      studentId: studentProfileId,
      assignedById: admin.id,
      status: "ACTIVE",
    });
    await expect(db.mentorAssignment.count({ where: { prSubmissionId: submission.id, mentorId: lightId } })).resolves.toBe(0);
    await expect(db.pRSubmission.findUnique({ where: { id: submission.id } })).resolves.toMatchObject({
      status: "ASSIGNED",
    });
    await expect(
      db.auditLog.findFirst({ where: { targetId: assigned.data.assignmentId, action: "MENTOR_ASSIGNED", actorId: admin.id } }),
    ).resolves.not.toBeNull();
    await expect(
      db.notification.count({ where: { prSubmissionId: submission.id, recipientId: busy.id, type: "MENTOR_ASSIGNED" } }),
    ).resolves.toBe(1);
    await expect(
      db.notification.count({ where: { prSubmissionId: submission.id, recipientId: student.id, type: "MENTOR_ASSIGNED" } }),
    ).resolves.toBe(1);

    const duplicate = await mentorAssignmentService.assign(admin.id, submission.id, busyId);
    expect(duplicate).toMatchObject({ ok: false, code: "invalid" });
    await expect(db.mentorAssignment.count({ where: { prSubmissionId: submission.id, status: "ACTIVE" } })).resolves.toBe(1);
  });

  it("rejects inactive mentors, the wrong stack, closed submissions, and non-admins", async () => {
    const suffix = id();
    const admin = await person("ADMIN", suffix, "admin");
    const student = await person("STUDENT", suffix, "student");
    const mentor = await person("MENTOR", suffix, "mentor", { approval: "APPROVED" });
    const stack = await db.techStack.create({ data: { name: `assign-test-closed-${suffix}` } });
    const studentProfileId = student.studentProfile?.id;
    const mentorProfileId = mentor.mentorProfile?.id;
    if (!studentProfileId || !mentorProfileId) {
      throw new Error("profiles missing");
    }

    const submission = await db.pRSubmission.create({
      data: {
        studentId: studentProfileId,
        githubPrUrl: `https://github.com/assign-${suffix}/closed/pull/1`,
        repository: `assign-${suffix}/closed`,
        techStackId: stack.id,
        status: "CLOSED",
      },
    });

    expect((await mentorAssignmentService.listEligibleMentors(student.id, submission.id)).ok).toBe(false);
    expect((await mentorAssignmentService.assign(student.id, submission.id, mentorProfileId)).ok).toBe(false);
    expect((await mentorAssignmentService.assign(mentor.id, submission.id, mentorProfileId)).ok).toBe(false);

    await db.mentorTechStack.create({ data: { mentorId: mentorProfileId, techStackId: stack.id } });
    const closed = await mentorAssignmentService.assign(admin.id, submission.id, mentorProfileId);
    expect(closed).toMatchObject({ ok: false, code: "invalid" });
    await expect(db.mentorAssignment.count({ where: { prSubmissionId: submission.id } })).resolves.toBe(0);

    await db.pRSubmission.update({ where: { id: submission.id }, data: { status: "PENDING" } });
    await db.user.update({ where: { id: mentor.id }, data: { deactivatedAt: new Date() } });
    const inactive = await mentorAssignmentService.assign(admin.id, submission.id, mentorProfileId);
    expect(inactive).toMatchObject({ ok: false, code: "invalid" });
    const listed = await mentorAssignmentService.listEligibleMentors(admin.id, submission.id);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data).toEqual([]);
    }
    await expect(db.mentorAssignment.count({ where: { prSubmissionId: submission.id } })).resolves.toBe(0);
  });
});
