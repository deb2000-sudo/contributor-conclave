import { Prisma } from "@/generated/prisma/client";

import { adminInvalid, requireAdminActor, type AdminError, type AdminSuccess } from "@/lib/admin/access";
import {
  isDuplicateActiveAssignment,
  rankEligibleMentors,
  statusAfterAssignment,
  type EligibleMentor,
} from "@/lib/admin/mentor-assignment";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { ensureAssignmentConversation } from "@/lib/messaging/service";
import { z } from "zod";

function parseUuid(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function eligibleMentorWhere(techStackId: string) {
  return {
    approvalStatus: "APPROVED" as const,
    user: { role: "MENTOR" as const, deactivatedAt: null },
    techStacks: { some: { techStackId } },
  };
}

async function listEligibleMentors(
  actorId: string,
  submissionId: string,
): Promise<AdminSuccess<EligibleMentor[]> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(submissionId)) {
    return adminInvalid("Submission not found.");
  }

  const submission = await db.pRSubmission.findUnique({
    where: { id: submissionId },
    select: {
      techStackId: true,
      assignments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { mentorId: true },
      },
    },
  });

  if (!submission) {
    return adminInvalid("Submission not found.");
  }

  const activeMentorId = submission.assignments[0]?.mentorId;
  const mentors = await db.mentorProfile.findMany({
    where: {
      ...eligibleMentorWhere(submission.techStackId),
      ...(activeMentorId ? { id: { not: activeMentorId } } : {}),
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    take: 100,
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
      _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
    },
  });

  return {
    ok: true,
    data: rankEligibleMentors(
      mentors.map((mentor) => ({
        id: mentor.id,
        name: `${mentor.user.firstName} ${mentor.user.lastName}`,
        activeAssignmentCount: mentor._count.assignments,
      })),
    ),
  };
}

async function assign(
  actorId: string,
  submissionId: string,
  mentorProfileId: string,
): Promise<AdminSuccess<{ assignmentId: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(submissionId) || !parseUuid(mentorProfileId)) {
    return adminInvalid("Choose a mentor for this submission.");
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      const submission = await tx.pRSubmission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          studentId: true,
          techStackId: true,
          status: true,
          student: { select: { userId: true } },
        },
      });

      if (!submission) {
        return { kind: "missing" as const };
      }

      const nextStatus = statusAfterAssignment(submission.status);
      if (!nextStatus.assignable) {
        return { kind: "closed" as const };
      }

      const mentor = await tx.mentorProfile.findFirst({
        where: { id: mentorProfileId, ...eligibleMentorWhere(submission.techStackId) },
        select: { id: true, userId: true },
      });

      if (!mentor) {
        return { kind: "ineligible" as const };
      }

      const current = await tx.mentorAssignment.findFirst({
        where: { prSubmissionId: submission.id, status: "ACTIVE" },
        select: { id: true, mentorId: true },
      });

      if (isDuplicateActiveAssignment(current?.mentorId ?? null, mentor.id)) {
        return { kind: "duplicate" as const };
      }

      if (current) {
        await tx.mentorAssignment.update({
          where: { id: current.id },
          data: { status: "REASSIGNED" },
        });
      }

      const created = await tx.mentorAssignment.create({
        data: {
          prSubmissionId: submission.id,
          studentId: submission.studentId,
          mentorId: mentor.id,
          assignedById: actor.data.id,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (nextStatus.changed) {
        await tx.pRSubmission.update({
          where: { id: submission.id },
          data: { status: nextStatus.status },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.data.id,
          action: current ? "MENTOR_REASSIGNED" : "MENTOR_ASSIGNED",
          targetType: "MENTOR_ASSIGNMENT",
          targetId: created.id,
          detail: `submission=${submission.id} mentor=${mentor.id}`.slice(0, 500),
        },
      });

      await tx.notification.createMany({
        data: [
          {
            recipientId: mentor.userId,
            type: "MENTOR_ASSIGNED",
            prSubmissionId: submission.id,
          },
          {
            recipientId: submission.student.userId,
            type: "MENTOR_ASSIGNED",
            prSubmissionId: submission.id,
          },
        ],
      });

      await ensureAssignmentConversation(tx, {
        submissionId: submission.id,
        studentUserId: submission.student.userId,
        mentorUserId: mentor.userId,
      });

      return { kind: "ok" as const, assignmentId: created.id };
    });

    if (outcome.kind === "missing") {
      return adminInvalid("Submission not found.");
    }
    if (outcome.kind === "closed") {
      return adminInvalid("Closed submissions cannot be assigned.");
    }
    if (outcome.kind === "ineligible") {
      return adminInvalid("Choose an approved, active mentor for this tech stack.");
    }
    if (outcome.kind === "duplicate") {
      return adminInvalid("That mentor is already assigned.");
    }

    return { ok: true, data: { assignmentId: outcome.assignmentId } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return adminInvalid("This submission was just assigned. Refresh and try again.");
    }

    logError("mentor_assignment.assign_failed", { actorId });
    return adminInvalid("The mentor could not be assigned. Try again.");
  }
}

export const mentorAssignmentService = {
  listEligibleMentors,
  assign,
};
