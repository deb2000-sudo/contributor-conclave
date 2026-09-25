import { z } from "zod";

import { db } from "@/lib/db";

export type MentorActor = { userId: string; mentorId: string };

export type MentorError = {
  ok: false;
  code: "unauthenticated" | "forbidden" | "invalid";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type MentorSuccess<T> = { ok: true; data: T };

export function mentorForbidden(): MentorError {
  return { ok: false, code: "forbidden", message: "You do not have access to this resource." };
}

export function mentorInvalid(message: string, fieldErrors?: Record<string, string[]>): MentorError {
  return { ok: false, code: "invalid", message, fieldErrors };
}

export function parseUuid(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

/** Role and profile come from the database row for this user id. Callers cannot supply a role. */
export async function requireMentorActor(userId: string): Promise<MentorSuccess<MentorActor> | MentorError> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      deactivatedAt: true,
      mentorProfile: { select: { id: true } },
    },
  });

  if (!user) {
    return { ok: false, code: "unauthenticated", message: "Authentication required." };
  }

  if (user.role !== "MENTOR" || user.deactivatedAt || !user.mentorProfile) {
    return mentorForbidden();
  }

  return { ok: true, data: { userId: user.id, mentorId: user.mentorProfile.id } };
}

export async function loadActiveAssignment(mentorId: string, submissionId: string) {
  if (!parseUuid(submissionId)) {
    return null;
  }

  return db.mentorAssignment.findFirst({
    where: { mentorId, status: "ACTIVE", prSubmissionId: submissionId },
    select: {
      id: true,
      studentId: true,
      prSubmission: {
        select: {
          id: true,
          status: true,
          student: { select: { userId: true } },
        },
      },
    },
  });
}
