import { Prisma, type AssignmentStatus, type AuditAction, type PRSubmissionStatus } from "@/generated/prisma/client";

import { adminInvalid, requireAdminActor, type AdminError, type AdminSuccess } from "@/lib/admin/access";
import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import type { EligibleMentor } from "@/lib/admin/mentor-assignment";
import { ADMIN_PAGE_SIZE, clampPage, type AdminPage } from "@/lib/admin/query";
import type { TechStackOption } from "@/lib/admin/people";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { z } from "zod";

export type SubmissionListItem = {
  id: string;
  studentName: string;
  studentId: string;
  repository: string;
  githubPrUrl: string;
  techStack: string;
  status: PRSubmissionStatus;
  submittedAt: Date;
};

export type { EligibleMentor };

export type SubmissionDetail = SubmissionListItem & {
  techStackId: string;
  activeMentor: { id: string; name: string } | null;
  eligibleMentors: EligibleMentor[];
};

export type AssignmentListItem = {
  id: string;
  studentName: string;
  mentorName: string;
  repository: string;
  githubPrUrl: string;
  submissionId: string;
  status: AssignmentStatus;
  createdAt: Date;
};

export type TechStackListItem = {
  id: string;
  name: string;
  submissionCount: number;
  mentorCount: number;
};

export type AuditListItem = {
  id: string;
  action: AuditAction;
  actorName: string;
  targetType: string;
  targetId: string;
  detail: string | null;
  createdAt: Date;
};

export type AdminOverview = {
  activeStudents: number;
  activeMentors: number;
  pendingApprovals: number;
  pendingSubmissions: number;
  activeAssignments: number;
};

function parseUuid(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listTechStackOptions(
  actorId: string,
): Promise<AdminSuccess<TechStackOption[]> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const stacks = await db.techStack.findMany({
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  return { ok: true, data: stacks };
}

export async function overview(
  actorId: string,
): Promise<AdminSuccess<AdminOverview> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const [activeStudents, activeMentors, pendingApprovals, pendingSubmissions, activeAssignments] =
    await Promise.all([
      db.user.count({ where: { role: "STUDENT", deactivatedAt: null } }),
      db.user.count({ where: { role: "MENTOR", deactivatedAt: null } }),
      db.mentorProfile.count({
        where: { approvalStatus: "PENDING", user: { deactivatedAt: null } },
      }),
      db.pRSubmission.count({ where: { status: "PENDING" } }),
      db.mentorAssignment.count({ where: { status: "ACTIVE" } }),
    ]);

  return {
    ok: true,
    data: { activeStudents, activeMentors, pendingApprovals, pendingSubmissions, activeAssignments },
  };
}

export async function listSubmissions(
  actorId: string,
  query: { page: number; search: string; status: PRSubmissionStatus | "all"; techStackId: string | null },
): Promise<AdminSuccess<AdminPage<SubmissionListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where: Prisma.PRSubmissionWhereInput = {
    ...(query.status === "all" ? {} : { status: query.status }),
    ...(query.techStackId ? { techStackId: query.techStackId } : {}),
    ...(search
      ? {
          OR: [
            { repository: { contains: search, mode: "insensitive" } },
            { student: { user: { firstName: { contains: search, mode: "insensitive" } } } },
            { student: { user: { lastName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const total = await db.pRSubmission.count({ where });
  const page = clampPage(query.page, total);
  const submissions = await db.pRSubmission.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      repository: true,
      githubPrUrl: true,
      status: true,
      submittedAt: true,
      techStack: { select: { name: true } },
      student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return {
    ok: true,
    data: {
      items: submissions.map((submission) => ({
        id: submission.id,
        studentName: `${submission.student.user.firstName} ${submission.student.user.lastName}`,
        studentId: submission.student.userId,
        repository: submission.repository,
        githubPrUrl: submission.githubPrUrl,
        techStack: submission.techStack.name,
        status: submission.status,
        submittedAt: submission.submittedAt,
      })),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}

export async function getSubmission(
  actorId: string,
  submissionId: string,
): Promise<AdminSuccess<SubmissionDetail> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(submissionId)) {
    return adminInvalid("Submission not found.");
  }

  const submission = await db.pRSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      repository: true,
      githubPrUrl: true,
      status: true,
      submittedAt: true,
      techStackId: true,
      techStack: { select: { name: true } },
      student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
      assignments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          mentorId: true,
          mentor: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  if (!submission) {
    return adminInvalid("Submission not found.");
  }

  const mentors = await mentorAssignmentService.listEligibleMentors(actorId, submission.id);
  if (!mentors.ok) {
    return mentors;
  }

  const active = submission.assignments[0];

  return {
    ok: true,
    data: {
      id: submission.id,
      studentName: `${submission.student.user.firstName} ${submission.student.user.lastName}`,
      studentId: submission.student.userId,
      repository: submission.repository,
      githubPrUrl: submission.githubPrUrl,
      techStack: submission.techStack.name,
      techStackId: submission.techStackId,
      status: submission.status,
      submittedAt: submission.submittedAt,
      activeMentor: active
        ? {
            id: active.mentorId,
            name: `${active.mentor.user.firstName} ${active.mentor.user.lastName}`,
          }
        : null,
      eligibleMentors: mentors.data,
    },
  };
}

export function assignMentor(
  actorId: string,
  submissionId: string,
  mentorProfileId: string,
): Promise<AdminSuccess<{ assignmentId: string }> | AdminError> {
  return mentorAssignmentService.assign(actorId, submissionId, mentorProfileId);
}

export async function listAssignments(
  actorId: string,
  query: { page: number; search: string },
): Promise<AdminSuccess<AdminPage<AssignmentListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where: Prisma.MentorAssignmentWhereInput = search
    ? {
        OR: [
          { prSubmission: { repository: { contains: search, mode: "insensitive" } } },
          { student: { user: { lastName: { contains: search, mode: "insensitive" } } } },
          { mentor: { user: { lastName: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : {};
  const total = await db.mentorAssignment.count({ where });
  const page = clampPage(query.page, total);
  const assignments = await db.mentorAssignment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      status: true,
      createdAt: true,
      prSubmission: { select: { id: true, repository: true, githubPrUrl: true } },
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
      mentor: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return {
    ok: true,
    data: {
      items: assignments.map((assignment) => ({
        id: assignment.id,
        studentName: `${assignment.student.user.firstName} ${assignment.student.user.lastName}`,
        mentorName: `${assignment.mentor.user.firstName} ${assignment.mentor.user.lastName}`,
        repository: assignment.prSubmission.repository,
        githubPrUrl: assignment.prSubmission.githubPrUrl,
        submissionId: assignment.prSubmission.id,
        status: assignment.status,
        createdAt: assignment.createdAt,
      })),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}

export async function listTechStacks(
  actorId: string,
  query: { page: number; search: string },
): Promise<AdminSuccess<AdminPage<TechStackListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where: Prisma.TechStackWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};
  const total = await db.techStack.count({ where });
  const page = clampPage(query.page, total);
  const stacks = await db.techStack.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      _count: { select: { submissions: true, mentors: true } },
    },
  });

  return {
    ok: true,
    data: {
      items: stacks.map((stack) => ({
        id: stack.id,
        name: stack.name,
        submissionCount: stack._count.submissions,
        mentorCount: stack._count.mentors,
      })),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}

async function techStackNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const existing = await db.techStack.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

export async function createTechStack(
  actorId: string,
  name: string,
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (await techStackNameTaken(name)) {
    return adminInvalid("A tech stack with that name already exists.", {
      name: ["A tech stack with that name already exists."],
    });
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const stack = await tx.techStack.create({ data: { name }, select: { id: true } });
      await tx.auditLog.create({
        data: {
          actorId: actor.data.id,
          action: "TECH_STACK_CREATED",
          targetType: "TECH_STACK",
          targetId: stack.id,
          detail: name.slice(0, 500),
        },
      });
      return stack;
    });
    return { ok: true, data: created };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return adminInvalid("A tech stack with that name already exists.", {
        name: ["A tech stack with that name already exists."],
      });
    }
    logError("admin.tech_stack_create_failed", { actorId: actor.data.id });
    return adminInvalid("The tech stack could not be created. Try again.");
  }
}

export async function renameTechStack(
  actorId: string,
  techStackId: string,
  name: string,
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(techStackId)) {
    return adminInvalid("Tech stack not found.");
  }

  const current = await db.techStack.findUnique({ where: { id: techStackId }, select: { id: true } });
  if (!current) {
    return adminInvalid("Tech stack not found.");
  }

  if (await techStackNameTaken(name, current.id)) {
    return adminInvalid("A tech stack with that name already exists.", {
      name: ["A tech stack with that name already exists."],
    });
  }

  try {
    await db.$transaction([
      db.techStack.update({ where: { id: current.id }, data: { name } }),
      db.auditLog.create({
        data: {
          actorId: actor.data.id,
          action: "TECH_STACK_UPDATED",
          targetType: "TECH_STACK",
          targetId: current.id,
          detail: name.slice(0, 500),
        },
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return adminInvalid("A tech stack with that name already exists.", {
        name: ["A tech stack with that name already exists."],
      });
    }
    logError("admin.tech_stack_rename_failed", { actorId: actor.data.id });
    return adminInvalid("The tech stack could not be renamed. Try again.");
  }

  return { ok: true, data: { id: current.id } };
}

export async function listAuditLogs(
  actorId: string,
  query: { page: number; search: string },
): Promise<AdminSuccess<AdminPage<AuditListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where: Prisma.AuditLogWhereInput = search
    ? {
        OR: [
          { detail: { contains: search, mode: "insensitive" } },
          { actor: { firstName: { contains: search, mode: "insensitive" } } },
          { actor: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const total = await db.auditLog.count({ where });
  const page = clampPage(query.page, total);
  const logs = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      detail: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    ok: true,
    data: {
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: `${log.actor.firstName} ${log.actor.lastName}`,
        targetType: log.targetType,
        targetId: log.targetId,
        detail: log.detail,
        createdAt: log.createdAt,
      })),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}
