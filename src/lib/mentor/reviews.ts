import type { PRSubmissionStatus, ReviewDecision, ReviewState } from "@/generated/prisma/client";

import {
  loadActiveAssignment,
  mentorForbidden,
  mentorInvalid,
  requireMentorActor,
  type MentorError,
  type MentorSuccess,
} from "@/lib/mentor/access";
import { MENTOR_PAGE_SIZE, paged, type MentorPage } from "@/lib/mentor/query";
import { parseReview } from "@/lib/mentor/validation";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { openStoredMessage } from "@/lib/messaging/crypto";

export type MentorReviewRecord = {
  id: string;
  decision: ReviewDecision;
  comment: string;
  createdAt: Date;
  mentorName: string;
};

export type PullRequestDetail = {
  submissionId: string;
  studentUserId: string;
  studentName: string;
  repository: string;
  githubPrUrl: string;
  techStack: string;
  submittedAt: Date;
  status: PRSubmissionStatus;
  reviewState: ReviewState;
  canStart: boolean;
  canReview: boolean;
  reviewsTruncated: boolean;
  reviews: MentorReviewRecord[];
  messagesTruncated: boolean;
  messages: MentorChatMessage[];
};

export type ReviewHistoryItem = {
  id: string;
  decision: ReviewDecision;
  comment: string;
  createdAt: Date;
  submissionId: string;
  stillAssigned: boolean;
  studentUserId: string;
  studentName: string;
  repository: string;
  githubPrUrl: string;
  techStack: string;
  submittedAt: Date;
  status: PRSubmissionStatus;
  reviewState: ReviewState;
};

export type MentorChatMessage = {
  id: string;
  body: string;
  createdAt: Date;
  senderName: string;
};

const MESSAGE_WINDOW = 30;
const REVIEW_WINDOW = 20;

function canReviewStatus(status: PRSubmissionStatus): boolean {
  return (
    status === "ASSIGNED" ||
    status === "IN_REVIEW" ||
    status === "CHANGES_REQUESTED" ||
    status === "APPROVED"
  );
}

function nextStatus(decision: ReviewDecision): PRSubmissionStatus {
  return decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED";
}

export async function getPullRequest(
  actorId: string,
  submissionId: string,
): Promise<MentorSuccess<PullRequestDetail> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const assignment = await loadActiveAssignment(actor.data.mentorId, submissionId);
  if (!assignment) {
    return mentorForbidden();
  }

  const submission = await db.pRSubmission.findUnique({
    where: { id: assignment.prSubmission.id },
    select: {
      id: true,
      repository: true,
      githubPrUrl: true,
      status: true,
      reviewState: true,
      submittedAt: true,
      techStack: { select: { name: true } },
      student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: REVIEW_WINDOW + 1,
        select: {
          id: true,
          decision: true,
          comment: true,
          createdAt: true,
          mentor: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      conversation: {
        select: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: MESSAGE_WINDOW + 1,
            select: {
              id: true,
              body: true,
              protection: true,
              createdAt: true,
              sender: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!submission) {
    return mentorForbidden();
  }

  const reviewsTruncated = submission.reviews.length > REVIEW_WINDOW;
  const visibleReviews = reviewsTruncated ? submission.reviews.slice(0, REVIEW_WINDOW) : submission.reviews;
  const messages = submission.conversation?.messages ?? [];
  const messagesTruncated = messages.length > MESSAGE_WINDOW;
  const visibleMessages = (messagesTruncated ? messages.slice(0, MESSAGE_WINDOW) : messages).slice().reverse();

  return {
    ok: true,
    data: {
      submissionId: submission.id,
      studentUserId: submission.student.userId,
      studentName: `${submission.student.user.firstName} ${submission.student.user.lastName}`,
      repository: submission.repository,
      githubPrUrl: submission.githubPrUrl,
      techStack: submission.techStack.name,
      submittedAt: submission.submittedAt,
      status: submission.status,
      reviewState: submission.reviewState,
      canStart: submission.status === "ASSIGNED",
      canReview: canReviewStatus(submission.status),
      reviewsTruncated,
      reviews: visibleReviews.map((review) => ({
        id: review.id,
        decision: review.decision,
        comment: review.comment,
        createdAt: review.createdAt,
        mentorName: `${review.mentor.user.firstName} ${review.mentor.user.lastName}`,
      })),
      messagesTruncated,
      messages: visibleMessages.map((message) => ({
        id: message.id,
        body: openStoredMessage(message.protection, message.body).text ?? "This message is protected and cannot be shown here.",
        createdAt: message.createdAt,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      })),
    },
  };
}

export async function listReviewHistory(
  actorId: string,
  input: { page: number },
): Promise<MentorSuccess<MentorPage<ReviewHistoryItem>> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const where = { mentorId: actor.data.mentorId };
  const total = await db.pRReview.count({ where });
  const page = await paged(input.page, total, (skip) =>
    db.pRReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: MENTOR_PAGE_SIZE,
      select: {
        id: true,
        decision: true,
        comment: true,
        createdAt: true,
        prSubmission: {
          select: {
            id: true,
            repository: true,
            githubPrUrl: true,
            status: true,
            reviewState: true,
            submittedAt: true,
            techStack: { select: { name: true } },
            student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
            assignments: {
              where: { mentorId: actor.data.mentorId, status: "ACTIVE" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
  );

  return {
    ok: true,
    data: {
      ...page,
      items: page.items.map((review) => ({
        id: review.id,
        decision: review.decision,
        comment: review.comment,
        createdAt: review.createdAt,
        submissionId: review.prSubmission.id,
        stillAssigned: review.prSubmission.assignments.length > 0,
        studentUserId: review.prSubmission.student.userId,
        studentName: `${review.prSubmission.student.user.firstName} ${review.prSubmission.student.user.lastName}`,
        repository: review.prSubmission.repository,
        githubPrUrl: review.prSubmission.githubPrUrl,
        techStack: review.prSubmission.techStack.name,
        submittedAt: review.prSubmission.submittedAt,
        status: review.prSubmission.status,
        reviewState: review.prSubmission.reviewState,
      })),
    },
  };
}

export async function startReview(
  actorId: string,
  submissionId: string,
): Promise<MentorSuccess<{ submissionId: string }> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const assignment = await loadActiveAssignment(actor.data.mentorId, submissionId);
  if (!assignment) {
    return mentorForbidden();
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.pRSubmission.findUnique({
        where: { id: assignment.prSubmission.id },
        select: { status: true },
      });

      if (!current) {
        return { kind: "missing" as const };
      }

      if (current.status === "IN_REVIEW") {
        return { kind: "ready" as const };
      }

      if (current.status !== "ASSIGNED") {
        return { kind: "blocked" as const };
      }

      await tx.pRSubmission.update({
        where: { id: assignment.prSubmission.id },
        data: { status: "IN_REVIEW" },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.data.userId,
          action: "REVIEW_STARTED",
          targetType: "PR_SUBMISSION",
          targetId: assignment.prSubmission.id,
          detail: "status=IN_REVIEW",
        },
      });
      return { kind: "started" as const };
    });

    if (outcome.kind === "blocked" || outcome.kind === "missing") {
      return mentorInvalid("Only an assigned submission can be marked in review.");
    }

    return { ok: true, data: { submissionId: assignment.prSubmission.id } };
  } catch {
    logError("mentor.start_review_failed", { actorId: actor.data.userId });
    return mentorInvalid("The review could not be started. Try again.");
  }
}

export async function postReview(
  actorId: string,
  submissionId: string,
  input: unknown,
): Promise<MentorSuccess<{ submissionId: string }> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const parsed = parseReview(input);
  if (!parsed.ok) {
    return parsed;
  }

  const assignment = await loadActiveAssignment(actor.data.mentorId, submissionId);
  if (!assignment) {
    return mentorForbidden();
  }

  const decision = parsed.data.decision;
  const status = nextStatus(decision);

  try {
    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.pRSubmission.findUnique({
        where: { id: assignment.prSubmission.id },
        select: { status: true },
      });

      if (!current || !canReviewStatus(current.status)) {
        return { kind: "blocked" as const };
      }

      const review = await tx.pRReview.create({
        data: {
          prSubmissionId: assignment.prSubmission.id,
          mentorId: actor.data.mentorId,
          decision,
          comment: parsed.data.comment,
        },
      });
      await tx.pRSubmission.update({
        where: { id: assignment.prSubmission.id },
        data: { status, reviewState: decision },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.data.userId,
          action: "REVIEW_POSTED",
          targetType: "PR_REVIEW",
          targetId: review.id,
          detail: `decision=${decision} status=${status} submission=${assignment.prSubmission.id}`.slice(0, 500),
        },
      });
      await tx.notification.create({
        data: {
          recipientId: assignment.prSubmission.student.userId,
          type: "REVIEW_POSTED",
          prSubmissionId: assignment.prSubmission.id,
        },
      });
      return { kind: "ok" as const };
    });

    if (outcome.kind === "blocked") {
      return mentorInvalid("This submission cannot be reviewed.");
    }

    return { ok: true, data: { submissionId: assignment.prSubmission.id } };
  } catch {
    logError("mentor.post_review_failed", { actorId: actor.data.userId });
    return mentorInvalid("The review could not be saved. Try again.");
  }
}
