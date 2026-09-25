"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStudent } from "@/lib/auth/authorization";
import {
  pullRequestSubmissionSchema,
  submissionFieldErrors,
} from "@/lib/student/submission-schema";
import { submitStudentPullRequest } from "@/lib/student/submissions";

export type SubmissionFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

function readForm(formData: FormData) {
  return {
    techStackId: formData.get("techStackId"),
    pullRequestUrl: formData.get("pullRequestUrl"),
  };
}

export async function submitPullRequestAction(
  _state: SubmissionFormState | undefined,
  formData: FormData,
): Promise<SubmissionFormState> {
  const user = await requireStudent();
  const parsed = pullRequestSubmissionSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { fieldErrors: submissionFieldErrors(parsed.error) };
  }

  const result = await submitStudentPullRequest(user.id, parsed.data);

  if (!result.ok) {
    return { formError: result.formError, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/student");
  revalidatePath("/student/submissions");
  revalidatePath("/admin/queue");
  redirect("/student/submissions?submitted=1");
}
