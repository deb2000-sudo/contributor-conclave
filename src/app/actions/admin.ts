"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { toFieldErrors } from "@/lib/auth/validation";
import { decideMentor, setAccountActive, updateMentor, updateStudent } from "@/lib/admin/people";
import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import { createTechStack, renameTechStack } from "@/lib/admin/workflow";
import {
  accountActiveSchema,
  mentorDecisionSchema,
  mentorUpdateSchema,
  profileUpdateSchema,
  techStackNameSchema,
} from "@/lib/admin/validation";
import { z } from "zod";

export type AdminFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const returnPathPattern =
  /^\/admin(?:\/(?:students|mentors|submissions|assignments|tech-stacks|approvals|audit)(?:\/[0-9a-fA-F-]{36})?)?$/;

function adminPath(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string" || !returnPathPattern.test(value)) {
    return fallback;
  }
  return value;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function fail(result: { message: string; fieldErrors?: Record<string, string[]> }): Promise<AdminFormState> {
  return { formError: result.message, fieldErrors: result.fieldErrors };
}

export async function updateStudentAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = profileUpdateSchema.safeParse({
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    batch: text(formData, "batch"),
    universityName: text(formData, "universityName"),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const userId = text(formData, "userId");
  const result = await updateStudent(admin.id, userId, parsed.data);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${result.data.id}`);
  redirect(`/admin/students/${result.data.id}?updated=1`);
}

export async function updateMentorAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = mentorUpdateSchema.safeParse({
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    batch: text(formData, "batch"),
    universityName: text(formData, "universityName"),
    techStackIds: formData.getAll("techStackId").filter((value): value is string => typeof value === "string"),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const userId = text(formData, "userId");
  const result = await updateMentor(admin.id, userId, parsed.data);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/mentors");
  revalidatePath(`/admin/mentors/${result.data.id}`);
  revalidatePath("/admin/approvals");
  redirect(`/admin/mentors/${result.data.id}?updated=1`);
}

export async function decideMentorAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = mentorDecisionSchema.safeParse(text(formData, "decision"));
  if (!parsed.success) {
    return { formError: "Choose approve or reject." };
  }

  const result = await decideMentor(admin.id, text(formData, "userId"), parsed.data);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/mentors");
  revalidatePath(`/admin/mentors/${result.data.id}`);
  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
  redirect(`${adminPath(formData.get("returnTo"), "/admin/approvals")}?updated=1`);
}

export async function setAccountActiveAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = accountActiveSchema.safeParse(text(formData, "active"));
  if (!parsed.success) {
    return { formError: "Choose whether the account is active." };
  }

  const userId = text(formData, "userId");
  const result = await setAccountActive(admin.id, userId, parsed.data === "true");
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/mentors");
  revalidatePath(`/admin/students/${result.data.id}`);
  revalidatePath(`/admin/mentors/${result.data.id}`);
  redirect(`${adminPath(formData.get("returnTo"), "/admin")}?updated=1`);
}

export async function assignMentorAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const mentorProfileId = text(formData, "mentorProfileId");
  if (!z.uuid().safeParse(mentorProfileId).success) {
    return { fieldErrors: { mentorProfileId: ["Choose a mentor."] } };
  }

  const submissionId = text(formData, "submissionId");
  const result = await mentorAssignmentService.assign(admin.id, submissionId, mentorProfileId);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/admin/assignments");
  revalidatePath("/admin");
  revalidatePath("/mentor");
  revalidatePath("/mentor/pull-requests");
  revalidatePath("/mentor/reviews");
  revalidatePath("/mentor/students");
  revalidatePath("/student");
  revalidatePath("/student/mentor");
  redirect(`/admin/submissions/${submissionId}?updated=1`);
}

export async function createTechStackAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = techStackNameSchema.safeParse(text(formData, "name"));
  if (!parsed.success) {
    return { fieldErrors: { name: parsed.error.issues.map((issue) => issue.message) } };
  }

  const result = await createTechStack(admin.id, parsed.data);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/tech-stacks");
  redirect("/admin/tech-stacks?updated=1");
}

export async function renameTechStackAction(
  _state: AdminFormState | undefined,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = techStackNameSchema.safeParse(text(formData, "name"));
  if (!parsed.success) {
    return { fieldErrors: { name: toFieldErrors(parsed.error).name ?? ["Enter a tech stack name."] } };
  }

  const result = await renameTechStack(admin.id, text(formData, "techStackId"), parsed.data);
  if (!result.ok) {
    return fail(result);
  }

  revalidatePath("/admin/tech-stacks");
  redirect("/admin/tech-stacks?updated=1");
}
