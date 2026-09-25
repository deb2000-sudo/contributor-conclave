"use client";

import { useActionState } from "react";

import { sendChatMessageAction, type ChatFormState } from "@/app/actions/messages";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextareaField } from "@/components/ui/textarea-field";

function FormError({ state }: { state: ChatFormState | undefined }) {
  if (!state?.formError) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {state.formError}
    </p>
  );
}

export function MessageForm({
  submissionId,
  returnTo,
}: {
  submissionId: string;
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(sendChatMessageAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <TextareaField
        id={`message-${submissionId}`}
        name="body"
        label="Message"
        required
        maxLength={2000}
        description="2000 characters maximum."
        errors={state?.fieldErrors?.body}
      />
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
