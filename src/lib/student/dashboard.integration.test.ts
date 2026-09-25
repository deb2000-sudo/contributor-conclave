import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  getStudentAccount,
  getStudentConversations,
  getStudentDashboard,
  getStudentMentors,
  getStudentOverviewLists,
  listStudentSubmissions,
} from "@/lib/student/dashboard";

const domain = "@student-dash-test.example";

function id() {
  return randomUUID().slice(0, 8);
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { endsWith: domain } },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  const profileIds = users.flatMap((user) => (user.studentProfile ? [user.studentProfile.id] : []));

  if (profileIds.length > 0) {
    const submissions = await db.pRSubmission.findMany({
      where: { studentId: { in: profileIds } },
      select: { id: true },
    });
    const submissionIds = submissions.map((submission) => submission.id);

    if (submissionIds.length > 0) {
      await db.message.deleteMany({ where: { conversation: { prSubmissionId: { in: submissionIds } } } });
      await db.conversationParticipant.deleteMany({
        where: { conversation: { prSubmissionId: { in: submissionIds } } },
      });
      await db.conversation.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.pRReview.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.mentorAssignment.deleteMany({ where: { prSubmissionId: { in: submissionIds } } });
      await db.pRSubmission.deleteMany({ where: { id: { in: submissionIds } } });
    }
  }

  await db.techStack.deleteMany({ where: { name: { startsWith: "dash-test-" } } });
  await db.user.deleteMany({ where: { email: { endsWith: domain } } });
}

afterEach(cleanup);

describe("student dashboard reads", () => {
  it("returns the signed-in student's profile, submission, mentor, and chat only", async () => {
    const suffix = id();
    const techStack = await db.techStack.create({
      data: { name: `dash-test-${suffix}` },
    });

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

    const mentor = await db.user.create({
      data: {
        role: "MENTOR",
        firstName: "Grace",
        lastName: "Hopper",
        email: `grace-${suffix}${domain}`,
        passwordHash: "stored-hash-not-for-the-client",
        mentorProfile: {
          create: {
            employeeId: `emp-${suffix}`,
            batch: "Batch 24",
            universityName: "Example University",
          },
        },
        githubAccount: { create: { username: `grace-${suffix}` } },
      },
      include: { mentorProfile: true },
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
      },
    });

    const profile = student.studentProfile;
    const mentorProfile = mentor.mentorProfile;
    if (!profile || !mentorProfile) {
      throw new Error("profiles missing");
    }

    const submission = await db.pRSubmission.create({
      data: {
        studentId: profile.id,
        githubPrUrl: `https://github.com/example/repo/pull/${suffix}`,
        repository: "example/repo",
        techStackId: techStack.id,
        reviewState: "CHANGES_REQUESTED",
      },
    });

    await db.mentorAssignment.create({
      data: {
        prSubmissionId: submission.id,
        studentId: profile.id,
        mentorId: mentorProfile.id,
        assignedById: mentor.id,
        status: "ACTIVE",
      },
    });

    await db.pRReview.create({
      data: {
        prSubmissionId: submission.id,
        mentorId: mentorProfile.id,
        decision: "CHANGES_REQUESTED",
        comment: "Please cover the empty state.",
      },
    });

    const conversation = await db.conversation.create({
      data: { prSubmissionId: submission.id },
    });
    await db.conversationParticipant.create({
      data: { conversationId: conversation.id, userId: student.id },
    });
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: mentor.id,
        body: "Look at the diff again.",
      },
    });

    const dashboard = await getStudentDashboard(student.id);
    const conversations = await getStudentConversations(student.id);
    const serialized = JSON.stringify({ dashboard, conversations });

    expect(dashboard).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      universityName: "Example University",
      batch: "Batch 24",
      githubUsername: `ada-${suffix}`,
    });
    expect(dashboard?.submissions).toHaveLength(1);
    expect(dashboard?.submissions[0]).toMatchObject({
      repository: "example/repo",
      reviewState: "CHANGES_REQUESTED",
      mentorName: "Grace Hopper",
      latestReview: { comment: "Please cover the empty state." },
    });
    expect(dashboard?.mentors[0]).toMatchObject({
      name: "Grace Hopper",
      githubUsername: `grace-${suffix}`,
      reviewState: "CHANGES_REQUESTED",
    });
    expect(conversations[0]?.messages[0]).toMatchObject({
      senderName: "Grace Hopper",
      body: "Look at the diff again.",
    });
    expect(serialized).not.toContain("stored-hash-not-for-the-client");
    expect(serialized).not.toContain("passwordHash");

    await expect(getStudentDashboard(other.id)).resolves.toMatchObject({
      universityName: "Other University",
      githubUsername: null,
      submissions: [],
      mentors: [],
    });
    await expect(getStudentConversations(other.id)).resolves.toEqual([]);

    await expect(getStudentAccount(student.id)).resolves.toMatchObject({
      githubUsername: `ada-${suffix}`,
      universityName: "Example University",
    });
    await expect(getStudentMentors(student.id)).resolves.toMatchObject([
      { name: "Grace Hopper", repository: "example/repo" },
    ]);
    await expect(getStudentOverviewLists(student.id)).resolves.toMatchObject({
      counts: { pending: 0, approved: 0, changes: 1 },
      submissions: [{ repository: "example/repo", mentorName: "Grace Hopper" }],
    });
    await expect(listStudentSubmissions(student.id, 1)).resolves.toMatchObject({
      total: 1,
      page: 1,
      submissions: [{ repository: "example/repo" }],
    });
    await expect(getStudentAccount(other.id)).resolves.toMatchObject({ githubUsername: null });
  });
});
