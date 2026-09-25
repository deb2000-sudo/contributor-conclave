"use client";

import { useActionState } from "react";

import { submitPullRequestAction } from "@/app/actions/submissions";
import { SubmitButton } from "@/components/auth/submit-button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";

export function SubmissionForm({
  stacks,
}: {
  stacks: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitPullRequestAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <SelectField
        id="tech-stack"
        name="techStackId"
        label="Tech stack"
        required
        errors={state?.fieldErrors?.techStackId}
        options={[
          { value: "", label: "Choose a tech stack" },
          ...stacks.map((stack) => ({ value: stack.id, label: stack.name })),
        ]}
      />
      <TextField
        id="pull-request-url"
        name="pullRequestUrl"
        label="GitHub pull request URL"
        type="url"
        required
        autoComplete="off"
        errors={state?.fieldErrors?.pullRequestUrl}
      />
      <p className="text-sm text-ink/70 dark:text-paper/70">
        Use a pull request you opened, such as https://github.com/owner/repo/pull/1.
      </p>
      {state?.formError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      ) : null}
      <SubmitButton pending={pending} pendingLabel="Submitting…">
        Submit
      </SubmitButton>
    </form>
  );
}
