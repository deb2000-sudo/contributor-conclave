import { z } from "zod";

import { toFieldErrors } from "@/lib/auth/validation";
import { messageBodySchema } from "@/lib/messaging/policy";
import { mentorInvalid, type MentorError } from "@/lib/mentor/access";

export const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"], {
    error: "Choose approve or request changes.",
  }),
  comment: z
    .string()
    .trim()
    .min(1, { error: "Enter a review comment." })
    .max(2000, { error: "Comment must be 2000 characters or fewer." }),
});

export const messageSchema = messageBodySchema;

export type MentorReviewInput = z.infer<typeof reviewSchema>;

export function parseReview(input: unknown): { ok: true; data: MentorReviewInput } | MentorError {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error);
    return mentorInvalid(fieldErrors.decision?.[0] ?? "Check the review and try again.", fieldErrors);
  }
  return { ok: true, data: parsed.data };
}

export function parseMessage(input: unknown): { ok: true; data: string } | MentorError {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return mentorInvalid(parsed.error.issues[0]?.message ?? "Enter a message.", {
      body: parsed.error.issues.map((issue) => issue.message),
    });
  }
  return { ok: true, data: parsed.data };
}
