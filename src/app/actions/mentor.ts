"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMentor } from "@/lib/auth/authorization";
import { sendMessage } from "@/lib/mentor/chat";
import { postReview, startReview } from "@/lib/mentor/reviews";

export type MentorFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const returnPathPattern =
  /^\/mentor(?:\/(?:students|pull-requests|reviews|history|tech-stack|chat|profile)(?:\/[0-9a-fA-F-]{36})?)?$/;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function mentorPath(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string" || !returnPathPattern.test(value)) {
    return fallback;
  }
  return value;
}

function refreshMentorViews(submissionId: string) {
  revalidatePath("/mentor");
  revalidatePath("/mentor/students");
  revalidatePath("/mentor/pull-requests");
  revalidatePath(`/mentor/pull-requests/${submissionId}`);
  revalidatePath("/mentor/reviews");
  revalidatePath("/mentor/history");
  revalidatePath("/mentor/chat");
  revalidatePath("/student");
  revalidatePath("/student/submissions");
  revalidatePath("/student/mentor");
  revalidatePath("/student/chat");
}

export async function startReviewAction(
  _state: MentorFormState | undefined,
  formData: FormData,
): Promise<MentorFormState> {
  const mentor = await requireMentor();
  const result = await startReview(mentor.id, text(formData, "submissionId"));
  if (!result.ok) {
    return { formError: result.message };
  }

  refreshMentorViews(result.data.submissionId);
  redirect(`/mentor/pull-requests/${result.data.submissionId}?started=1`);
}

export async function postReviewAction(
  _state: MentorFormState | undefined,
  formData: FormData,
): Promise<MentorFormState> {
  const mentor = await requireMentor();
  const result = await postReview(mentor.id, text(formData, "submissionId"), {
    decision: text(formData, "decision"),
    comment: text(formData, "comment"),
  });
  if (!result.ok) {
    return { formError: result.message, fieldErrors: result.fieldErrors };
  }

  refreshMentorViews(result.data.submissionId);
  redirect(`/mentor/pull-requests/${result.data.submissionId}?reviewed=1`);
}

export async function sendMessageAction(
  _state: MentorFormState | undefined,
  formData: FormData,
): Promise<MentorFormState> {
  const mentor = await requireMentor();
  const result = await sendMessage(mentor.id, text(formData, "submissionId"), text(formData, "body"));
  if (!result.ok) {
    return { formError: result.message, fieldErrors: result.fieldErrors };
  }

  refreshMentorViews(result.data.submissionId);
  const path = mentorPath(formData.get("returnTo"), `/mentor/pull-requests/${result.data.submissionId}`);
  redirect(`${path}?sent=1`);
}
