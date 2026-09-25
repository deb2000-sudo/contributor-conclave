export type MentorEligibility = {
  role: "STUDENT" | "MENTOR" | "ADMIN";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  deactivatedAt: Date | null;
  supportsStack: boolean;
};

export type EligibleMentor = {
  id: string;
  name: string;
  activeAssignmentCount: number;
};

/** An inactive, unapproved, or unmatched mentor cannot take a new assignment. */
export function isEligibleMentor(mentor: MentorEligibility): boolean {
  return (
    mentor.role === "MENTOR" &&
    mentor.approvalStatus === "APPROVED" &&
    mentor.deactivatedAt === null &&
    mentor.supportsStack
  );
}

/** Lower current load is listed first. The caller still chooses the mentor. */
export function rankEligibleMentors(mentors: EligibleMentor[]): EligibleMentor[] {
  return mentors.toSorted((left, right) => {
    if (left.activeAssignmentCount !== right.activeAssignmentCount) {
      return left.activeAssignmentCount - right.activeAssignmentCount;
    }
    return left.name.localeCompare(right.name);
  });
}

export function mentorChoiceLabel(mentor: EligibleMentor): string {
  const count = mentor.activeAssignmentCount;
  const noun = count === 1 ? "active assignment" : "active assignments";
  return `${mentor.name} · ${count} ${noun}`;
}

export function isDuplicateActiveAssignment(activeMentorId: string | null, selectedMentorId: string): boolean {
  return activeMentorId !== null && activeMentorId === selectedMentorId;
}

type SubmissionStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

/** A new assignment moves a pending submission to Assigned. Later statuses stay as they are. */
export function statusAfterAssignment(
  status: SubmissionStatus,
): { assignable: true; status: SubmissionStatus; changed: boolean } | { assignable: false } {
  if (status === "CLOSED") {
    return { assignable: false };
  }
  if (status === "PENDING") {
    return { assignable: true, status: "ASSIGNED", changed: true };
  }
  return { assignable: true, status, changed: false };
}
