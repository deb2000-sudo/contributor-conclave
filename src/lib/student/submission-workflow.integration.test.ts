import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { listSubmissionQueue } from "@/lib/admin/queue";
import { db } from "@/lib/db";
import type { GitHubResult, ValidatedPullRequest } from "@/lib/github/types";
import { getStudentDashboard } from "@/lib/student/dashboard";
import { submitStudentPullRequest } from "@/lib/student/submissions";

const domain = "@submission-test.example";

function id() {
  return randomUUID().slice(0, 8);
}

function validated(authorLogin: string | null): GitHubResult<ValidatedPullRequest> {
  return {
    ok: true,
    data: {
      owner: "octocat",
      repo: "hello",
      number: 7,
      url: "https://github.com/octocat/hello/pull/7",
      pullRequest: {
        number: 7,
        title: "Add a guide",
        body: null,
        state: "open",
        draft: false,
        merged: false,
        htmlUrl: "https://github.com/octocat/hello/pull/7",
        authorLogin,
        headRef: "guide",
        baseRef: "main",
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-02T00:00:00Z",
        commits: 1,
        additions: 1,
        deletions: 0,
        changedFiles: 1,
      },
    },
  };
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { endsWith: domain } },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  const userIds = users.map((user) => user.id);
  const profileIds = users.flatMap((user) => (user.studentProfile ? [user.studentProfile.id] : []));

  const submissions =
    profileIds.length === 0
      ? []
      : await db.pRSubmission.findMany({
          where: { studentId: { in: profileIds } },
          select: { id: true },
        });
  const submissionIds = submissions.map((submission) => submission.id);

  if (submissionIds.length > 0) {
    await db.notification.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
    await db.auditLog.deleteMany({ where: { targetId: { in: submissionIds } } });
    await db.pRSubmission.deleteMany({ where: { id: { in: submissionIds } } });
  }

  if (userIds.length > 0) {
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.notification.deleteMany({ where: { recipientId: { in: userIds } } });
  }

  await db.techStack.deleteMany({ where: { name: { startsWith: "submit-test-" } } });
  await db.user.deleteMany({ where: { email: { endsWith: domain } } });
}

afterEach(cleanup);

describe("student pull request submission", () => {
  it("stores a pending submission for the signed-in student and queues it for admins", async () => {
    const suffix = id();
    const techStack = await db.techStack.create({ data: { name: `submit-test-${suffix}` } });
    const student = await db.user.create({
      data: {
        role: "STUDENT",
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
        studentProfile: {
          create: {
            niatId: `niat-${suffix}`,
            batch: "Batch 24",
            universityName: "Example University",
          },
        },
        githubAccount: { create: { username: `ada-${suffix}` } },
      },
      include: { studentProfile: true },
    });
    const other = await db.user.create({
      data: {
        role: "STUDENT",
        firstName: "Other",
        lastName: "Student",
        email: `other-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
        studentProfile: {
          create: {
            niatId: `niat-other-${suffix}`,
            batch: "Batch 24",
            universityName: "Other University",
          },
        },
        githubAccount: { create: { username: `other-${suffix}` } },
      },
    });
    const admin = await db.user.create({
      data: {
        role: "ADMIN",
        firstName: "Admin",
        lastName: "User",
        email: `admin-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
      },
    });

    let calls = 0;
    const pullRequests = {
      validatePullRequestUrl: async () => {
        calls += 1;
        return validated(`Ada-${suffix}`);
      },
    };
    const input = {
      techStackId: techStack.id,
      pullRequestUrl: `https://www.github.com/OctoCat/Hello-${suffix}/pull/7/files`,
    };

    const created = await submitStudentPullRequest(student.id, input, pullRequests);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const row = await db.pRSubmission.findUnique({ where: { id: created.submissionId } });
    expect(row).toMatchObject({
      studentId: student.studentProfile?.id,
      githubPrUrl: `https://github.com/octocat/hello-${suffix}/pull/7`,
      repository: `octocat/hello-${suffix}`,
      techStackId: techStack.id,
      status: "PENDING",
      reviewState: "PENDING",
    });
    expect(row?.submittedAt).toBeInstanceOf(Date);
    expect(row?.createdAt).toBeInstanceOf(Date);

    const audit = await db.auditLog.findFirst({
      where: { targetId: created.submissionId, action: "SUBMISSION_SUBMITTED" },
    });
    expect(audit).toMatchObject({
      actorId: student.id,
      targetType: "PR_SUBMISSION",
      detail: `status=PENDING repository=octocat/hello-${suffix} pull=7`,
    });

    const notification = await db.notification.findFirst({
      where: { recipientId: admin.id, prSubmissionId: created.submissionId },
    });
    expect(notification?.type).toBe("PR_SUBMITTED");

    const queue = await listSubmissionQueue();
    expect(queue.some((item) => item.id === created.submissionId)).toBe(true);

    const ownerView = await getStudentDashboard(student.id);
    const otherView = await getStudentDashboard(other.id);
    expect(ownerView?.submissions.map((submission) => submission.id)).toContain(created.submissionId);
    expect(otherView?.submissions).toEqual([]);

    const duplicate = await submitStudentPullRequest(
      other.id,
      { ...input, pullRequestUrl: `https://github.com/octocat/hello-${suffix}/pull/7` },
      pullRequests,
    );
    expect(duplicate).toMatchObject({
      ok: false,
      fieldErrors: { pullRequestUrl: ["This pull request has already been submitted."] },
    });
    expect(calls).toBe(1);
    await expect(
      db.pRSubmission.count({ where: { githubPrUrl: `https://github.com/octocat/hello-${suffix}/pull/7` } }),
    ).resolves.toBe(1);

    const serialized = JSON.stringify({ created, audit, notification, queue, ownerView });
    expect(serialized).not.toContain("stored-hash-not-for-the-client");
  });

  it("rejects a pull request opened by someone else and a malformed URL", async () => {
    const suffix = id();
    const techStack = await db.techStack.create({ data: { name: `submit-test-deny-${suffix}` } });
    const student = await db.user.create({
      data: {
        role: "STUDENT",
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada-deny-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
        studentProfile: {
          create: {
            niatId: `niat-deny-${suffix}`,
            batch: "Batch 24",
            universityName: "Example University",
          },
        },
        githubAccount: { create: { username: `ada-${suffix}` } },
      },
    });

    const denied = await submitStudentPullRequest(
      student.id,
      {
        techStackId: techStack.id,
        pullRequestUrl: "https://github.com/octocat/hello/pull/7",
      },
      { validatePullRequestUrl: async () => validated("someone-else") },
    );
    expect(denied).toMatchObject({
      ok: false,
      fieldErrors: {
        pullRequestUrl: ["Submit a pull request opened by your linked GitHub account."],
      },
    });

    let called = false;
    const malformed = await submitStudentPullRequest(
      student.id,
      {
        techStackId: techStack.id,
        pullRequestUrl: "https://github.com/octocat/hello/issues/7",
      },
      {
        validatePullRequestUrl: async () => {
          called = true;
          return validated(`ada-${suffix}`);
        },
      },
    );
    expect(malformed.ok).toBe(false);
    expect(called).toBe(false);
    await expect(db.pRSubmission.count({ where: { student: { userId: student.id } } })).resolves.toBe(0);
    await expect(db.auditLog.count({ where: { actorId: student.id } })).resolves.toBe(0);
  });

  it("leaves assigned submissions out of the admin queue", async () => {
    const suffix = id();
    const techStack = await db.techStack.create({ data: { name: `submit-test-queue-${suffix}` } });
    const student = await db.user.create({
      data: {
        role: "STUDENT",
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada-queue-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
        studentProfile: {
          create: {
            niatId: `niat-queue-${suffix}`,
            batch: "Batch 24",
            universityName: "Example University",
          },
        },
      },
      include: { studentProfile: true },
    });
    const profileId = student.studentProfile?.id;
    if (!profileId) {
      throw new Error("profile missing");
    }

    const assigned = await db.pRSubmission.create({
      data: {
        studentId: profileId,
        githubPrUrl: `https://github.com/example/queue/pull/${suffix}`,
        repository: "example/queue",
        techStackId: techStack.id,
        status: "ASSIGNED",
      },
    });

    const queue = await listSubmissionQueue();
    expect(queue.some((item) => item.id === assigned.id)).toBe(false);
  });
});
