import { PRSubmissionStatus } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { submissionLabel } from "@/lib/student/labels";
import {
  canonicalSubmission,
  pullRequestAuthorMatches,
  pullRequestSubmissionSchema,
  submissionFieldErrors,
} from "@/lib/student/submission-schema";

const stackId = "6f1d7e3a-1b2c-4d5e-8f90-a1b2c3d4e5f6";

describe("pull request submission input", () => {
  it("accepts a GitHub pull request URL and a tech stack id", () => {
    const parsed = pullRequestSubmissionSchema.safeParse({
      techStackId: stackId,
      pullRequestUrl: "  https://www.github.com/OctoCat/Hello/pull/7/files?diff=split  ",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(canonicalSubmission(parsed.data.pullRequestUrl)).toEqual({
      url: "https://github.com/octocat/hello/pull/7",
      repository: "octocat/hello",
      number: 7,
    });
  });

  it("rejects malformed URLs before a submission is stored", () => {
    const cases = [
      "",
      "not a url",
      "http://github.com/octocat/hello/pull/1",
      "https://example.com/octocat/hello/pull/1",
      "https://github.com/octocat/hello/issues/1",
      "https://user:secret@github.com/octocat/hello/pull/1",
      "https://github.com/octocat/hello/pull/0",
      `https://github.com/${"a".repeat(120)}/hello/pull/1`,
    ];

    for (const pullRequestUrl of cases) {
      const parsed = pullRequestSubmissionSchema.safeParse({
        techStackId: stackId,
        pullRequestUrl,
      });
      expect(parsed.success, pullRequestUrl).toBe(false);
      if (parsed.success) {
        continue;
      }
      expect(submissionFieldErrors(parsed.error).pullRequestUrl?.length).toBeGreaterThan(0);
    }
  });

  it("rejects a missing tech stack id", () => {
    const parsed = pullRequestSubmissionSchema.safeParse({
      techStackId: "python",
      pullRequestUrl: "https://github.com/octocat/hello/pull/1",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(submissionFieldErrors(parsed.error).techStackId).toEqual(["Choose a tech stack."]);
  });

  it("matches the pull request author to the linked GitHub username", () => {
    expect(pullRequestAuthorMatches("Ada-User", "ada-user")).toBe(true);
    expect(pullRequestAuthorMatches("other", "ada-user")).toBe(false);
    expect(pullRequestAuthorMatches(null, "ada-user")).toBe(false);
  });

  it("labels every submission status", () => {
    const labels = Object.values(PRSubmissionStatus).map((status) => submissionLabel(status).label);
    expect(labels).toEqual([
      "Pending",
      "Assigned",
      "In review",
      "Changes requested",
      "Approved",
      "Rejected",
      "Closed",
    ]);
  });
});
