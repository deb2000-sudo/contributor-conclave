"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/authorization";
import { messagingService } from "@/lib/messaging/service";

export type ChatFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const returnPathPattern =
  /^\/(?:student\/chat|mentor\/chat|mentor\/pull-requests)(?:\/[0-9a-fA-F-]{36})?$/;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function sendChatMessageAction(
  _state: ChatFormState | undefined,
  formData: FormData,
): Promise<ChatFormState> {
  const user = await requireAuth();
  const submissionId = text(formData, "submissionId");
  const result = await messagingService.send(user.id, submissionId, text(formData, "body"));
  if (!result.ok) {
    return { formError: result.message, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/student/chat");
  revalidatePath(`/student/chat/${result.data.submissionId}`);
  revalidatePath("/mentor/chat");
  revalidatePath(`/mentor/chat/${result.data.submissionId}`);
  revalidatePath(`/mentor/pull-requests/${result.data.submissionId}`);

  const requested = formData.get("returnTo");
  const path = typeof requested === "string" && returnPathPattern.test(requested)
    ? requested
    : user.role === "MENTOR"
      ? `/mentor/chat/${result.data.submissionId}`
      : `/student/chat/${result.data.submissionId}`;
  redirect(`${path}?sent=1`);
}
