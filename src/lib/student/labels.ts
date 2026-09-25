import type { PRSubmissionStatus, ReviewState } from "@/generated/prisma/client";

import type { StudentSubmission } from "@/lib/student/dashboard";

const displayTimeZone = "Asia/Kolkata";

export function formatDay(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: displayTimeZone,
  }).format(date);
}

export function formatTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: displayTimeZone,
  }).format(date)} IST`;
}

export function reviewLabel(state: ReviewState): {
  tone: "pending" | "approved" | "changes";
  label: string;
} {
  switch (state) {
    case "PENDING":
      return { tone: "pending", label: "Pending" };
    case "APPROVED":
      return { tone: "approved", label: "Approved" };
    case "CHANGES_REQUESTED":
      return { tone: "changes", label: "Changes requested" };
  }
}

export function submissionLabel(status: PRSubmissionStatus): {
  tone: "neutral" | "pending" | "approved" | "changes" | "closed";
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { tone: "pending", label: "Pending" };
    case "ASSIGNED":
      return { tone: "neutral", label: "Assigned" };
    case "IN_REVIEW":
      return { tone: "pending", label: "In review" };
    case "CHANGES_REQUESTED":
      return { tone: "changes", label: "Changes requested" };
    case "APPROVED":
      return { tone: "approved", label: "Approved" };
    case "REJECTED":
      return { tone: "closed", label: "Rejected" };
    case "CLOSED":
      return { tone: "closed", label: "Closed" };
  }
}

export function pullRequestLabel(pull: { state: string; draft: boolean; merged: boolean }): {
  tone: "neutral" | "pending" | "approved" | "closed";
  label: string;
} {
  if (pull.merged) {
    return { tone: "approved", label: "Merged" };
  }
  if (pull.draft && pull.state === "open") {
    return { tone: "neutral", label: "Draft" };
  }
  if (pull.state === "open") {
    return { tone: "pending", label: "Open" };
  }
  if (pull.state === "closed") {
    return { tone: "closed", label: "Closed" };
  }
  return { tone: "neutral", label: pull.state };
}

export function reviewCounts(submissions: StudentSubmission[]) {
  return {
    pending: submissions.filter((submission) => submission.reviewState === "PENDING").length,
    approved: submissions.filter((submission) => submission.reviewState === "APPROVED").length,
    changes: submissions.filter((submission) => submission.reviewState === "CHANGES_REQUESTED")
      .length,
  };
}
