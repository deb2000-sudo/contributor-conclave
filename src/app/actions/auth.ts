"use server";

import { redirect } from "next/navigation";

import { authenticate, registerMentor, registerStudent } from "@/lib/auth/accounts";
import { homeForRole } from "@/lib/auth/authorization";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  loginSchema,
  mentorRegistrationSchema,
  studentRegistrationSchema,
  toFieldErrors,
} from "@/lib/auth/validation";

export type AuthFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function registerStudentAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = studentRegistrationSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const result = await registerStudent(parsed.data);

  if (!result.ok) {
    return { formError: result.formError, fieldErrors: result.fieldErrors };
  }

  await createSession(result.user.id);
  redirect(homeForRole(result.user.role));
}

export async function registerMentorAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = mentorRegistrationSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const result = await registerMentor(parsed.data);

  if (!result.ok) {
    return { formError: result.formError, fieldErrors: result.fieldErrors };
  }

  await createSession(result.user.id);
  redirect(homeForRole(result.user.role));
}

export async function loginAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    return { formError: result.formError };
  }

  await createSession(result.user.id);
  redirect(homeForRole(result.user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
