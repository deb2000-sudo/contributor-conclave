import { Prisma } from "@/generated/prisma/client";

import { github as defaultGitHub } from "@/lib/github/service";
import type { GitHubResult, ValidatedPullRequest } from "@/lib/github/types";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import {
  canonicalSubmission,
  pullRequestAuthorMatches,
  type PullRequestSubmission,
} from "@/lib/student/submission-schema";

export type SubmissionFailure = {
  ok: false;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

export type SubmissionSuccess = {
  ok: true;
  submissionId: string;
};

type PullRequestCheck = {
  validatePullRequestUrl: (value: string) => Promise<GitHubResult<ValidatedPullRequest>>;
};

const duplicateUrl = {
  ok: false as const,
  fieldErrors: {
    pullRequestUrl: ["This pull request has already been submitted."],
  },
};

function fieldError(field: string, message: string): SubmissionFailure {
  return { ok: false, fieldErrors: { [field]: [message] } };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listTechStacks() {
  return db.techStack.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function submitStudentPullRequest(
  userId: string,
  input: PullRequestSubmission,
  pullRequests: PullRequestCheck = defaultGitHub,
): Promise<SubmissionSuccess | SubmissionFailure> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      user: { select: { githubAccount: { select: { username: true } } } },
    },
  });

  if (!profile) {
    return { ok: false, formError: "This account has no student profile." };
  }

  const githubUsername = profile.user.githubAccount?.username ?? null;
  if (!githubUsername) {
    return {
      ok: false,
      formError: "Link a GitHub username before submitting a pull request.",
    };
  }

  const canonical = canonicalSubmission(input.pullRequestUrl);
  if (!canonical) {
    return fieldError(
      "pullRequestUrl",
      "Enter a GitHub pull request URL, such as https://github.com/owner/repo/pull/1.",
    );
  }

  const techStack = await db.techStack.findUnique({
    where: { id: input.techStackId },
    select: { id: true },
  });
  if (!techStack) {
    return fieldError("techStackId", "Choose a tech stack.");
  }

  const existing = await db.pRSubmission.findUnique({
    where: { githubPrUrl: canonical.url },
    select: { id: true },
  });
  if (existing) {
    return duplicateUrl;
  }

  const validated = await pullRequests.validatePullRequestUrl(input.pullRequestUrl);
  if (!validated.ok) {
    if (validated.code === "invalid_url" || validated.code === "not_found") {
      return fieldError("pullRequestUrl", validated.message);
    }
    return { ok: false, formError: validated.message };
  }

  if (!pullRequestAuthorMatches(validated.data.pullRequest.authorLogin, githubUsername)) {
    return fieldError(
      "pullRequestUrl",
      "Submit a pull request opened by your linked GitHub account.",
    );
  }

  const detail = `status=PENDING repository=${canonical.repository} pull=${canonical.number}`.slice(0, 500);

  try {
    const submission = await db.$transaction(async (tx) => {
      const created = await tx.pRSubmission.create({
        data: {
          studentId: profile.id,
          githubPrUrl: canonical.url,
          repository: canonical.repository,
          techStackId: techStack.id,
          status: "PENDING",
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "SUBMISSION_SUBMITTED",
          targetType: "PR_SUBMISSION",
          targetId: created.id,
          detail,
        },
      });

      const admins = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            recipientId: admin.id,
            type: "PR_SUBMITTED" as const,
            prSubmissionId: created.id,
          })),
        });
      }

      return created;
    });

    return { ok: true, submissionId: submission.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return duplicateUrl;
    }

    logError("pr_submission.create_failed", { userId });
    return { ok: false, formError: "The pull request could not be submitted. Try again." };
  }
}
