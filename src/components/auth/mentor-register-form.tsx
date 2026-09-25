"use client";

import { useActionState } from "react";

import { registerMentorAction } from "@/app/actions/auth";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";

export function MentorRegisterForm() {
  const [state, action, pending] = useActionState(registerMentorAction, undefined);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <Field id="firstName" name="firstName" label="First name" autoComplete="given-name" errors={errors?.firstName} />
      <Field id="lastName" name="lastName" label="Last name" autoComplete="family-name" errors={errors?.lastName} />
      <Field id="email" name="email" label="NxtWave email" type="email" autoComplete="email" errors={errors?.email} />
      <Field id="employeeId" name="employeeId" label="Employee ID" autoComplete="off" errors={errors?.employeeId} />
      <Field id="batch" name="batch" label="Batch" autoComplete="off" errors={errors?.batch} />
      <Field id="universityName" name="universityName" label="University name" autoComplete="organization" errors={errors?.universityName} />
      <Field id="githubUsername" name="githubUsername" label="GitHub username" autoComplete="username" errors={errors?.githubUsername} />
      <Field id="password" name="password" label="Password" type="password" autoComplete="new-password" errors={errors?.password} />
      <Field id="confirmPassword" name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" errors={errors?.confirmPassword} />
      {state?.formError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      ) : null}
      <SubmitButton pending={pending}>Create mentor account</SubmitButton>
    </form>
  );
}
