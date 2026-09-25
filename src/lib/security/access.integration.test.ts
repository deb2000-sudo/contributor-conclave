import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { requireAdminActor } from "@/lib/admin/access";
import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import { getStudent } from "@/lib/admin/people";
import type { GitHubResult, ValidatedPullRequest } from "@/lib/github/types";
import { requireMentorActor } from "@/lib/mentor/access";
import { getAssignedStudent } from "@/lib/mentor/directory";
import { startReview } from "@/lib/mentor/reviews";
import { parseReview } from "@/lib/mentor/validation";
import { parseMessageBody } from "@/lib/messaging/policy";
import { messagingService } from "@/lib/messaging/service";
import { getStudentDashboard } from "@/lib/student/dashboard";
import { submitStudentPullRequest } from "@/lib/student/submissions";

import { insertTechStack, insertUser, removeFixtures } from "@/test/fixtures";

const domain = "@security.test";
const stackPrefix = "Security ";
const privateBody = "private-thread-body";
const hiddenEmail = "hidden-student@security.test";
const hiddenRepository = "hidden/secret-repo";

let adminId = "";
let studentId = "";
let otherStudentId = "";
let mentorId = "";
let otherMentorId = "";
let mentorProfileId = "";
let stackId = "";
let secretSubmissionId = "";

function validated(url: string, number: number): GitHubResult<ValidatedPullRequest> {
  return {
    ok: true,
    data: {
      owner: "securitystudent",
      repo: "demo",
      number,
      url,
      pullRequest: {
        number,
        title: "Fixture",
        body: null,
        state: "open",
        draft: false,
        merged: false,
        htmlUrl: url,
        authorLogin: "securitystudent",
        headRef: "fixture",
        baseRef: "main",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        commits: 1,
        additions: 1,
        deletions: 0,
        changedFiles: 1,
      },
    },
  };
}

function withoutSecrets(value: unknown) {
  const encoded = JSON.stringify(value);
  expect(encoded).not.toContain(privateBody);
  expect(encoded).not.toContain(hiddenEmail);
  expect(encoded).not.toContain(hiddenRepository);
}

beforeAll(async () => {
  await removeFixtures(domain, stackPrefix);
  const stack = await insertTechStack(`${stackPrefix}TypeScript`);
  stackId = stack.id;
  const admin = await insertUser({
    role: "ADMIN",
    email: `admin${domain}`,
    firstName: "Ada",
    lastName: "Admin",
  });
  const student = await insertUser({
    role: "STUDENT",
    email: `student${domain}`,
    firstName: "Sita",
    lastName: "Student",
    githubUsername: "securitystudent",
    niatId: "SEC-NIAT-1",
  });
  const otherStudent = await insertUser({
    role: "STUDENT",
    email: hiddenEmail,
    firstName: "Hidden",
    lastName: "Student",
    githubUsername: "securityhidden",
    niatId: "SEC-NIAT-2",
  });
  const mentor = await insertUser({
    role: "MENTOR",
    email: `mentor${domain}`,
    firstName: "Mina",
    lastName: "Mentor",
    employeeId: "SEC-EMP-1",
    approvalStatus: "APPROVED",
    githubUsername: "securitymentor",
  });
  const otherMentor = await insertUser({
    role: "MENTOR",
    email: `other-mentor${domain}`,
    firstName: "Omar",
    lastName: "Mentor",
    employeeId: "SEC-EMP-2",
    approvalStatus: "APPROVED",
    githubUsername: "securityothermentor",
  });

  adminId = admin.id;
  studentId = student.id;
  otherStudentId = otherStudent.id;
  mentorId = mentor.id;
  otherMentorId = otherMentor.id;
  mentorProfileId = mentor.mentorProfile?.id ?? "";
  const otherMentorProfileId = otherMentor.mentorProfile?.id ?? "";

  const { db } = await import("@/lib/db");
  await db.mentorTechStack.createMany({
    data: [
      { mentorId: mentorProfileId, techStackId: stackId },
      { mentorId: otherMentorProfileId, techStackId: stackId },
    ],
  });
  const secret = await db.pRSubmission.create({
    data: {
      studentId: otherStudent.studentProfile?.id ?? "",
      githubPrUrl: "https://github.com/securityhidden/demo/pull/1",
      repository: hiddenRepository,
      techStackId: stackId,
      status: "PENDING",
    },
  });
  secretSubmissionId = secret.id;
  const assigned = await mentorAssignmentService.assign(adminId, secret.id, mentorProfileId);
  if (!assigned.ok) {
    throw new Error(assigned.message);
  }
  const sent = await messagingService.send(otherStudentId, secret.id, privateBody);
  if (!sent.ok) {
    throw new Error(sent.message);
  }
});

afterAll(async () => {
  await removeFixtures(domain, stackPrefix);
});

describe("security access boundaries", () => {
  it("rejects unknown actors as unauthenticated", async () => {
    const missing = randomUUID();
    expect(await requireAdminActor(missing)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await requireMentorActor(missing)).toMatchObject({ ok: false, code: "unauthenticated" });
    const conversation = await messagingService.getConversation(missing, secretSubmissionId, null);
    expect(conversation.ok).toBe(false);
    if (!conversation.ok) {
      expect(conversation.code).toBe("unauthenticated");
    }
    withoutSecrets(conversation);
  });

  it("blocks a student from admin actions and another student's data", async () => {
    expect(await requireAdminActor(studentId)).toMatchObject({ ok: false, code: "forbidden" });
    const studentRecord = await getStudent(studentId, otherStudentId);
    expect(studentRecord.ok).toBe(false);
    withoutSecrets(studentRecord);

    const assignment = await mentorAssignmentService.assign(studentId, secretSubmissionId, mentorProfileId);
    expect(assignment.ok).toBe(false);
    withoutSecrets(assignment);

    const conversation = await messagingService.getConversation(studentId, secretSubmissionId, null);
    expect(conversation).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(conversation);

    const dashboard = await getStudentDashboard(studentId);
    withoutSecrets(dashboard);
    expect(dashboard?.email).toBe(`student${domain}`);
  });

  it("blocks a mentor from admin actions and another mentor's student", async () => {
    expect(await requireAdminActor(mentorId)).toMatchObject({ ok: false, code: "forbidden" });
    const assignment = await mentorAssignmentService.assign(mentorId, secretSubmissionId, mentorProfileId);
    expect(assignment.ok).toBe(false);
    withoutSecrets(assignment);

    const student = await getAssignedStudent(otherMentorId, otherStudentId);
    expect(student).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(student);

    const review = await startReview(otherMentorId, secretSubmissionId);
    expect(review).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(review);

    const conversation = await messagingService.getConversation(otherMentorId, secretSubmissionId, null);
    expect(conversation).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(conversation);
  });

  it("rejects manipulated ids without returning another user's data", async () => {
    const studentLookup = await getStudent(adminId, "not-a-uuid");
    expect(studentLookup).toMatchObject({ ok: false, code: "invalid" });
    withoutSecrets(studentLookup);

    const missingStudent = await getStudent(adminId, randomUUID());
    expect(missingStudent.ok).toBe(false);
    withoutSecrets(missingStudent);

    const conversation = await messagingService.getConversation(studentId, "not-a-uuid", null);
    expect(conversation).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(conversation);

    const review = await startReview(mentorId, randomUUID());
    expect(review).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(review);

    const assigned = await getAssignedStudent(mentorId, "not-a-uuid");
    expect(assigned).toMatchObject({ ok: false, code: "forbidden" });
    withoutSecrets(assigned);
  });

  it("rejects invalid message, review, and pull request input", async () => {
    expect(parseMessageBody("").ok).toBe(false);
    expect(parseMessageBody("hello\u0000").ok).toBe(false);
    expect(parseReview({ decision: "APPROVED", comment: "   " }).ok).toBe(false);

    const checker = { validatePullRequestUrl: vi.fn() };
    const invalid = await submitStudentPullRequest(
      studentId,
      { techStackId: stackId, pullRequestUrl: "https://example.com/owner/repo/pull/1" },
      checker,
    );
    expect(invalid.ok).toBe(false);
    expect(checker.validatePullRequestUrl).not.toHaveBeenCalled();
  });

  it("rejects a duplicate pull request URL before calling GitHub again", async () => {
    const url = "https://github.com/securitystudent/demo/pull/9";
    const checker = {
      validatePullRequestUrl: vi.fn(async () => validated(url, 9)),
    };
    const input = { techStackId: stackId, pullRequestUrl: url };

    const created = await submitStudentPullRequest(studentId, input, checker);
    const duplicate = await submitStudentPullRequest(studentId, input, checker);

    expect(created.ok).toBe(true);
    expect(duplicate).toMatchObject({
      ok: false,
      fieldErrors: { pullRequestUrl: ["This pull request has already been submitted."] },
    });
    expect(checker.validatePullRequestUrl).toHaveBeenCalledTimes(1);
  });
});
