import type { MentorApprovalStatus, PRSubmissionStatus, ReviewState } from "@/generated/prisma/client";

import { mentorForbidden, parseUuid, requireMentorActor, type MentorError, type MentorSuccess } from "@/lib/mentor/access";
import { MENTOR_PAGE_SIZE, paged, type MentorPage } from "@/lib/mentor/query";
import { db } from "@/lib/db";

export type AssignedStudent = {
  userId: string;
  name: string;
  email: string;
  batch: string;
  universityName: string;
  assignmentCount: number;
};

export type AssignedStudentDetail = AssignedStudent & {
  githubUsername: string | null;
  pullRequests: AssignedPullRequest[];
  pullRequestCount: number;
};

export type AssignedPullRequest = {
  submissionId: string;
  studentUserId: string;
  studentName: string;
  repository: string;
  githubPrUrl: string;
  techStack: string;
  submittedAt: Date;
  status: PRSubmissionStatus;
  reviewState: ReviewState;
};

export type MentorOverview = {
  assignedStudents: number;
  assignedPullRequests: number;
  pendingReviews: number;
  reviewsWritten: number;
  recent: AssignedPullRequest[];
};

export type MentorProfileView = {
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  batch: string;
  universityName: string;
  approvalStatus: MentorApprovalStatus;
  githubUsername: string | null;
};

export type TechStackItem = { id: string; name: string; truncated: boolean };

const activeAssignment = { status: "ACTIVE" as const };

const pullRequestSelect = {
  id: true,
  repository: true,
  githubPrUrl: true,
  status: true,
  reviewState: true,
  submittedAt: true,
  techStack: { select: { name: true } },
  student: {
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

function studentName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

function toPullRequest(submission: {
  id: string;
  repository: string;
  githubPrUrl: string;
  status: PRSubmissionStatus;
  reviewState: ReviewState;
  submittedAt: Date;
  techStack: { name: string };
  student: { userId: string; user: { firstName: string; lastName: string } };
}): AssignedPullRequest {
  return {
    submissionId: submission.id,
    studentUserId: submission.student.userId,
    studentName: studentName(submission.student.user),
    repository: submission.repository,
    githubPrUrl: submission.githubPrUrl,
    techStack: submission.techStack.name,
    submittedAt: submission.submittedAt,
    status: submission.status,
    reviewState: submission.reviewState,
  };
}

function studentWhere(mentorId: string, search: string) {
  return {
    assignments: { some: { mentorId, ...activeAssignment } },
    ...(search
      ? {
          OR: [
            { batch: { contains: search, mode: "insensitive" as const } },
            { universityName: { contains: search, mode: "insensitive" as const } },
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function pendingWhere(mentorId: string) {
  return {
    mentorId,
    ...activeAssignment,
    prSubmission: {
      reviewState: "PENDING" as const,
      status: { in: ["ASSIGNED", "IN_REVIEW"] as PRSubmissionStatus[] },
    },
  };
}

export async function overview(actorId: string): Promise<MentorSuccess<MentorOverview> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const assigned = { mentorId: actor.data.mentorId, ...activeAssignment };
  const pending = pendingWhere(actor.data.mentorId);
  const [assignedStudents, assignedPullRequests, pendingReviews, reviewsWritten, recent] = await Promise.all([
    db.studentProfile.count({ where: { assignments: { some: assigned } } }),
    db.mentorAssignment.count({ where: assigned }),
    db.mentorAssignment.count({ where: pending }),
    db.pRReview.count({ where: { mentorId: actor.data.mentorId } }),
    db.mentorAssignment.findMany({
      where: pending,
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { prSubmission: { select: pullRequestSelect } },
    }),
  ]);

  return {
    ok: true,
    data: {
      assignedStudents,
      assignedPullRequests,
      pendingReviews,
      reviewsWritten,
      recent: recent.map((row) => toPullRequest(row.prSubmission)),
    },
  };
}

export async function listAssignedStudents(
  actorId: string,
  input: { page: number; search: string },
): Promise<MentorSuccess<MentorPage<AssignedStudent>> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const where = studentWhere(actor.data.mentorId, input.search.trim().slice(0, 80));
  const total = await db.studentProfile.count({ where });
  const page = await paged(input.page, total, (skip) =>
    db.studentProfile.findMany({
      where,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      skip,
      take: MENTOR_PAGE_SIZE,
      select: {
        userId: true,
        batch: true,
        universityName: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { assignments: { where: { mentorId: actor.data.mentorId, ...activeAssignment } } } },
      },
    }),
  );

  return {
    ok: true,
    data: {
      ...page,
      items: page.items.map((student) => ({
        userId: student.userId,
        name: studentName(student.user),
        email: student.user.email,
        batch: student.batch,
        universityName: student.universityName,
        assignmentCount: student._count.assignments,
      })),
    },
  };
}

export async function getAssignedStudent(
  actorId: string,
  studentUserId: string,
): Promise<MentorSuccess<AssignedStudentDetail> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(studentUserId)) {
    return mentorForbidden();
  }

  const assigned = { mentorId: actor.data.mentorId, ...activeAssignment };
  const student = await db.studentProfile.findFirst({
    where: { userId: studentUserId, assignments: { some: assigned } },
    select: {
      userId: true,
      batch: true,
      universityName: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          githubAccount: { select: { username: true } },
        },
      },
      assignments: {
        where: assigned,
        orderBy: { createdAt: "desc" },
        take: MENTOR_PAGE_SIZE,
        select: { prSubmission: { select: pullRequestSelect } },
      },
      _count: { select: { assignments: { where: assigned } } },
    },
  });

  if (!student) {
    return mentorForbidden();
  }

  return {
    ok: true,
    data: {
      userId: student.userId,
      name: studentName(student.user),
      email: student.user.email,
      batch: student.batch,
      universityName: student.universityName,
      githubUsername: student.user.githubAccount?.username ?? null,
      assignmentCount: student._count.assignments,
      pullRequestCount: student._count.assignments,
      pullRequests: student.assignments.map((assignment) => toPullRequest(assignment.prSubmission)),
    },
  };
}

export async function listAssignedPullRequests(
  actorId: string,
  input: { page: number; search: string; status: PRSubmissionStatus | "all"; techStackId: string | null },
): Promise<MentorSuccess<MentorPage<AssignedPullRequest>> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = input.search.trim().slice(0, 80);
  const where = {
    mentorId: actor.data.mentorId,
    ...activeAssignment,
    prSubmission: {
      ...(input.status === "all" ? {} : { status: input.status }),
      ...(input.techStackId ? { techStackId: input.techStackId } : {}),
      ...(search
        ? {
            OR: [
              { repository: { contains: search, mode: "insensitive" as const } },
              { student: { user: { firstName: { contains: search, mode: "insensitive" as const } } } },
              { student: { user: { lastName: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
  };
  const total = await db.mentorAssignment.count({ where });
  const page = await paged(input.page, total, (skip) =>
    db.mentorAssignment.findMany({
      where,
      orderBy: { prSubmission: { submittedAt: "desc" } },
      skip,
      take: MENTOR_PAGE_SIZE,
      select: { prSubmission: { select: pullRequestSelect } },
    }),
  );

  return {
    ok: true,
    data: { ...page, items: page.items.map((row) => toPullRequest(row.prSubmission)) },
  };
}

export async function listPendingReviews(
  actorId: string,
  input: { page: number },
): Promise<MentorSuccess<MentorPage<AssignedPullRequest>> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const where = pendingWhere(actor.data.mentorId);
  const total = await db.mentorAssignment.count({ where });
  const page = await paged(input.page, total, (skip) =>
    db.mentorAssignment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: MENTOR_PAGE_SIZE,
      select: { prSubmission: { select: pullRequestSelect } },
    }),
  );

  return {
    ok: true,
    data: { ...page, items: page.items.map((row) => toPullRequest(row.prSubmission)) },
  };
}

export async function listSubmissionStacks(
  actorId: string,
): Promise<MentorSuccess<{ id: string; name: string }[]> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const stacks = await db.techStack.findMany({
    where: {
      submissions: {
        some: { assignments: { some: { mentorId: actor.data.mentorId, ...activeAssignment } } },
      },
    },
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  return { ok: true, data: stacks };
}

export async function listMentorTechStacks(actorId: string): Promise<MentorSuccess<TechStackItem[]> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const [total, stacks] = await Promise.all([
    db.mentorTechStack.count({ where: { mentorId: actor.data.mentorId } }),
    db.techStack.findMany({
      where: { mentors: { some: { mentorId: actor.data.mentorId } } },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true },
    }),
  ]);
  const truncated = total > stacks.length;

  return {
    ok: true,
    data: stacks.map((stack) => ({ ...stack, truncated })),
  };
}

export async function getMentorProfile(actorId: string): Promise<MentorSuccess<MentorProfileView> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const profile = await db.mentorProfile.findUnique({
    where: { id: actor.data.mentorId },
    select: {
      employeeId: true,
      batch: true,
      universityName: true,
      approvalStatus: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          githubAccount: { select: { username: true } },
        },
      },
    },
  });

  if (!profile) {
    return mentorForbidden();
  }

  return {
    ok: true,
    data: {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      email: profile.user.email,
      employeeId: profile.employeeId,
      batch: profile.batch,
      universityName: profile.universityName,
      approvalStatus: profile.approvalStatus,
      githubUsername: profile.user.githubAccount?.username ?? null,
    },
  };
}
