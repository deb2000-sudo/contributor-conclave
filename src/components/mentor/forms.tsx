"use client";

import { useActionState } from "react";

import { postReviewAction, startReviewAction, type MentorFormState } from "@/app/actions/mentor";
import { SubmitButton } from "@/components/auth/submit-button";
import { focusRing } from "@/components/ui/styles";
import { TextareaField } from "@/components/ui/textarea-field";

function FormError({ state }: { state: MentorFormState | undefined }) {
  if (!state?.formError) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {state.formError}
    </p>
  );
}

const choiceClass = `inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium disabled:opacity-60 ${focusRing}`;

export function StartReviewForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(startReviewAction, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Updating…">
        Mark in review
      </SubmitButton>
    </form>
  );
}

export function ReviewForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(postReviewAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <TextareaField
        id={`review-comment-${submissionId}`}
        name="comment"
        label="Review comment"
        required
        maxLength={2000}
        description="2000 characters maximum."
        errors={state?.fieldErrors?.comment}
      />
      <FormError state={state} />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="APPROVED"
          disabled={pending}
          className={`${choiceClass} bg-moss-700 text-white dark:bg-moss-300 dark:text-moss-900`}
        >
          {pending ? "Saving…" : "Approve review"}
        </button>
        <button
          type="submit"
          name="decision"
          value="CHANGES_REQUESTED"
          disabled={pending}
          className={`${choiceClass} border border-ink/20 text-ink dark:border-paper/20 dark:text-paper`}
        >
          Request changes
        </button>
      </div>
    </form>
  );
}

