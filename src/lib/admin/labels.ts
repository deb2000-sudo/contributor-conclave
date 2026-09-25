import type { AssignmentStatus, AuditAction, MentorApprovalStatus } from "@/generated/prisma/client";

export function accountLabel(deactivatedAt: Date | null): {
  tone: "approved" | "closed";
  label: string;
} {
  return deactivatedAt
    ? { tone: "closed", label: "Deactivated" }
    : { tone: "approved", label: "Active" };
}

export function approvalLabel(status: MentorApprovalStatus): {
  tone: "pending" | "approved" | "closed";
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { tone: "pending", label: "Pending" };
    case "APPROVED":
      return { tone: "approved", label: "Approved" };
    case "REJECTED":
      return { tone: "closed", label: "Rejected" };
  }
}

export function assignmentLabel(status: AssignmentStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "REASSIGNED":
      return "Reassigned";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
  }
}

export function auditActionLabel(action: AuditAction): string {
  switch (action) {
    case "MENTOR_ASSIGNED":
      return "Mentor assigned";
    case "MENTOR_REASSIGNED":
      return "Mentor reassigned";
    case "ASSIGNMENT_CANCELLED":
      return "Assignment cancelled";
    case "USER_ROLE_CHANGED":
      return "Role changed";
    case "SUBMISSION_CLOSED":
      return "Submission closed";
    case "SUBMISSION_SUBMITTED":
      return "Submission submitted";
    case "REVIEW_STARTED":
      return "Review started";
    case "REVIEW_POSTED":
      return "Review posted";
    case "MESSAGE_SENT":
      return "Message sent";
    case "STUDENT_UPDATED":
      return "Student updated";
    case "USER_DEACTIVATED":
      return "Account deactivated";
    case "USER_REACTIVATED":
      return "Account reactivated";
    case "MENTOR_APPROVED":
      return "Mentor approved";
    case "MENTOR_REJECTED":
      return "Mentor rejected";
    case "MENTOR_UPDATED":
      return "Mentor updated";
    case "TECH_STACK_CREATED":
      return "Tech stack created";
    case "TECH_STACK_UPDATED":
      return "Tech stack updated";
  }
}
