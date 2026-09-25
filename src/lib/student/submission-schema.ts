import { z } from "zod";

import { canonicalPullRequestUrl, parsePullRequestUrl } from "@/lib/github/parse";

import { toFieldErrors } from "@/lib/auth/validation";

const pullRequestUrlSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a GitHub pull request URL." })
  .max(300, { error: "Pull request URL must be 300 characters or fewer." })
  .refine((value) => parsePullRequestUrl(value) !== null, {
    error: "Enter a GitHub pull request URL, such as https://github.com/owner/repo/pull/1.",
  });

export const pullRequestSubmissionSchema = z.object({
  techStackId: z.string().trim().pipe(z.uuid({ error: "Choose a tech stack." })),
  pullRequestUrl: pullRequestUrlSchema,
});

export type PullRequestSubmission = z.infer<typeof pullRequestSubmissionSchema>;

export function submissionFieldErrors(error: z.ZodError): Record<string, string[]> {
  return toFieldErrors(error);
}

export function canonicalSubmission(value: string): {
  url: string;
  repository: string;
  number: number;
} | null {
  const parsed = parsePullRequestUrl(value);
  if (!parsed) {
    return null;
  }

  const url = canonicalPullRequestUrl(parsed);
  return {
    url,
    repository: `${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`,
    number: parsed.number,
  };
}

export function pullRequestAuthorMatches(
  authorLogin: string | null,
  githubUsername: string,
): boolean {
  if (!authorLogin) {
    return false;
  }

  return authorLogin.toLowerCase() === githubUsername.toLowerCase();
}
