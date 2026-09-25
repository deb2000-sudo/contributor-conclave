"use client";

import { useActionState } from "react";

import {
  assignMentorAction,
  createTechStackAction,
  decideMentorAction,
  renameTechStackAction,
  setAccountActiveAction,
  updateMentorAction,
  updateStudentAction,
  type AdminFormState,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/auth/submit-button";
import { mentorChoiceLabel, type EligibleMentor } from "@/lib/admin/mentor-assignment";
import { controlClass, focusRing } from "@/components/ui/styles";
import { TextField } from "@/components/ui/text-field";

function FormError({ state }: { state: AdminFormState | undefined }) {
  if (!state?.formError) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {state.formError}
    </p>
  );
}

export function StudentProfileForm({
  userId,
  firstName,
  lastName,
  batch,
  universityName,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  batch: string;
  universityName: string;
}) {
  const [state, action, pending] = useActionState(updateStudentAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <TextField id="first-name" name="firstName" label="First name" required defaultValue={firstName} errors={state?.fieldErrors?.firstName} />
      <TextField id="last-name" name="lastName" label="Last name" required defaultValue={lastName} errors={state?.fieldErrors?.lastName} />
      <TextField id="batch" name="batch" label="Batch" required defaultValue={batch} errors={state?.fieldErrors?.batch} />
      <TextField id="university" name="universityName" label="University" required defaultValue={universityName} errors={state?.fieldErrors?.universityName} />
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save student
      </SubmitButton>
    </form>
  );
}

export function MentorProfileForm({
  userId,
  firstName,
  lastName,
  batch,
  universityName,
  techStacks,
  techStackIds,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  batch: string;
  universityName: string;
  techStacks: { id: string; name: string }[];
  techStackIds: string[];
}) {
  const [state, action, pending] = useActionState(updateMentorAction, undefined);
  const selected = new Set(techStackIds);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <TextField id="mentor-first-name" name="firstName" label="First name" required defaultValue={firstName} errors={state?.fieldErrors?.firstName} />
      <TextField id="mentor-last-name" name="lastName" label="Last name" required defaultValue={lastName} errors={state?.fieldErrors?.lastName} />
      <TextField id="mentor-batch" name="batch" label="Batch" required defaultValue={batch} errors={state?.fieldErrors?.batch} />
      <TextField id="mentor-university" name="universityName" label="University" required defaultValue={universityName} errors={state?.fieldErrors?.universityName} />
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={state?.fieldErrors?.techStackIds ? "mentor-tech-stacks-error" : undefined}
      >
        <legend className="text-sm font-medium">Tech stacks</legend>
        {techStacks.length === 0 ? (
          <p className="text-sm text-ink/70 dark:text-paper/70">No tech stacks exist yet.</p>
        ) : (
          techStacks.map((stack) => (
            <label key={stack.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="techStackId"
                value={stack.id}
                defaultChecked={selected.has(stack.id)}
                className={`size-6 ${focusRing}`}
              />
              {stack.name}
            </label>
          ))
        )}
        {state?.fieldErrors?.techStackIds ? (
          <p id="mentor-tech-stacks-error" className="text-sm text-amber-800 dark:text-amber-100">
            {state.fieldErrors.techStackIds[0]}
          </p>
        ) : null}
      </fieldset>
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save mentor
      </SubmitButton>
    </form>
  );
}

export function MentorDecisionForm({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(decideMentorAction, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        name="decision"
        value="APPROVED"
        disabled={pending}
        className={`inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 ${focusRing}`}
      >
        {pending ? "Saving…" : "Approve"}
      </button>
      <button
        type="submit"
        name="decision"
        value="REJECTED"
        disabled={pending}
        className={`inline-flex h-11 items-center justify-center rounded-full border border-ink/20 px-5 text-sm font-medium disabled:opacity-60 dark:border-paper/25 ${focusRing}`}
      >
        Reject
      </button>
      <FormError state={state} />
    </form>
  );
}

export function AccountActiveForm({
  userId,
  active,
  returnTo,
}: {
  userId: string;
  active: boolean;
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(setAccountActiveAction, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? "true" : "false"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        {active ? "Reactivate account" : "Deactivate account"}
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

export function AssignMentorForm({
  submissionId,
  mentors,
}: {
  submissionId: string;
  mentors: EligibleMentor[];
}) {
  const [state, action, pending] = useActionState(assignMentorAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="mentor-profile" className="text-sm font-medium">
          Mentor
        </label>
        <select
          id="mentor-profile"
          name="mentorProfileId"
          required
          defaultValue=""
          aria-invalid={state?.fieldErrors?.mentorProfileId ? true : undefined}
          aria-describedby={
            state?.fieldErrors?.mentorProfileId ? "mentor-profile-hint mentor-profile-error" : "mentor-profile-hint"
          }
          className={controlClass}
        >
          <option value="">Choose a mentor</option>
          {mentors.map((mentor) => (
            <option key={mentor.id} value={mentor.id}>
              {mentorChoiceLabel(mentor)}
            </option>
          ))}
        </select>
        <p id="mentor-profile-hint" className="text-sm text-ink/70 dark:text-paper/70">
          Select a mentor. The count is how many pull requests they are already assigned.
        </p>
        {state?.fieldErrors?.mentorProfileId ? (
          <p id="mentor-profile-error" className="text-sm text-amber-800 dark:text-amber-100">
            {state.fieldErrors.mentorProfileId[0]}
          </p>
        ) : null}
      </div>
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Assigning…">
        Assign mentor
      </SubmitButton>
    </form>
  );
}

export function CreateTechStackForm() {
  const [state, action, pending] = useActionState(createTechStackAction, undefined);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <TextField id="tech-stack-name" name="name" label="New tech stack" required errors={state?.fieldErrors?.name} />
      <FormError state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Add tech stack
      </SubmitButton>
    </form>
  );
}

export function RenameTechStackForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(renameTechStackAction, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="techStackId" value={id} />
      <TextField id={`stack-${id}`} name="name" label="Name" required defaultValue={name} errors={state?.fieldErrors?.name} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Rename
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}
