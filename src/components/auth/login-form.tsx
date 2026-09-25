"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/actions/auth";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state?.fieldErrors?.email}
      />
      <Field
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state?.fieldErrors?.password}
      />
      {state?.formError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      ) : null}
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
