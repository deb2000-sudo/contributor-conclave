import { Prisma, type PRSubmissionStatus } from "@/generated/prisma/client";

import { adminInvalid, requireAdminActor, type AdminError, type AdminSuccess } from "@/lib/admin/access";
import type { MentorUpdate, ProfileUpdate } from "@/lib/admin/validation";
import { ADMIN_PAGE_SIZE, clampPage, type AdminPage } from "@/lib/admin/query";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { z } from "zod";

export type StudentListItem = {
  id: string;
  name: string;
  email: string;
  niatId: string;
  batch: string;
  universityName: string;
  deactivatedAt: Date | null;
};

export type StudentDetail = StudentListItem & {
  firstName: string;
  lastName: string;
  githubUsername: string | null;
  submissionCount: number;
  recentSubmissions: {
    id: string;
    repository: string;
    status: PRSubmissionStatus;
    githubPrUrl: string;
    submittedAt: Date;
  }[];
};

export type MentorListItem = {
  id: string;
  profileId: string;
  name: string;
  email: string;
  employeeId: string;
  batch: string;
  universityName: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  deactivatedAt: Date | null;
};

export type TechStackOption = { id: string; name: string };

export type MentorDetail = MentorListItem & {
  firstName: string;
  lastName: string;
  githubUsername: string | null;
  techStackIds: string[];
  techStacks: TechStackOption[];
};

function parseUuid(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

function studentWhere(search: string, account: "all" | "active" | "deactivated"): Prisma.UserWhereInput {
  return {
    role: "STUDENT",
    studentProfile: { isNot: null },
    ...(account === "active" ? { deactivatedAt: null } : {}),
    ...(account === "deactivated" ? { deactivatedAt: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { studentProfile: { is: { niatId: { contains: search, mode: "insensitive" } } } },
            { studentProfile: { is: { batch: { contains: search, mode: "insensitive" } } } },
            { studentProfile: { is: { universityName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

function mentorWhere(
  search: string,
  account: "all" | "active" | "deactivated",
  approval: "all" | "PENDING" | "APPROVED" | "REJECTED",
): Prisma.UserWhereInput {
  return {
    role: "MENTOR",
    mentorProfile: approval === "all" ? { isNot: null } : { is: { approvalStatus: approval } },
    ...(account === "active" ? { deactivatedAt: null } : {}),
    ...(account === "deactivated" ? { deactivatedAt: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { mentorProfile: { is: { employeeId: { contains: search, mode: "insensitive" } } } },
            { mentorProfile: { is: { batch: { contains: search, mode: "insensitive" } } } },
            { mentorProfile: { is: { universityName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

export async function listStudents(
  actorId: string,
  query: { page: number; search: string; account: "all" | "active" | "deactivated" },
): Promise<AdminSuccess<AdminPage<StudentListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where = studentWhere(search, query.account);
  const total = await db.user.count({ where });
  const page = clampPage(query.page, total);
  const users = await db.user.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deactivatedAt: true,
      studentProfile: { select: { niatId: true, batch: true, universityName: true } },
    },
  });

  return {
    ok: true,
    data: {
      items: users.flatMap((user) => {
        if (!user.studentProfile) {
          return [];
        }
        return [
          {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            niatId: user.studentProfile.niatId,
            batch: user.studentProfile.batch,
            universityName: user.studentProfile.universityName,
            deactivatedAt: user.deactivatedAt,
          },
        ];
      }),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}

export async function getStudent(
  actorId: string,
  userId: string,
): Promise<AdminSuccess<StudentDetail> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Student not found.");
  }

  const user = await db.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deactivatedAt: true,
      githubAccount: { select: { username: true } },
      studentProfile: {
        select: {
          niatId: true,
          batch: true,
          universityName: true,
          _count: { select: { submissions: true } },
          submissions: {
            orderBy: { submittedAt: "desc" },
            take: 10,
            select: {
              id: true,
              repository: true,
              status: true,
              githubPrUrl: true,
              submittedAt: true,
            },
          },
        },
      },
    },
  });

  if (!user?.studentProfile) {
    return adminInvalid("Student not found.");
  }

  return {
    ok: true,
    data: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      niatId: user.studentProfile.niatId,
      batch: user.studentProfile.batch,
      universityName: user.studentProfile.universityName,
      deactivatedAt: user.deactivatedAt,
      githubUsername: user.githubAccount?.username ?? null,
      submissionCount: user.studentProfile._count.submissions,
      recentSubmissions: user.studentProfile.submissions,
    },
  };
}

export async function updateStudent(
  actorId: string,
  userId: string,
  input: ProfileUpdate,
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Student not found.");
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: { id: true, user: { select: { role: true } } },
  });

  if (!profile || profile.user.role !== "STUDENT") {
    return adminInvalid("Student not found.");
  }

  try {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { firstName: input.firstName, lastName: input.lastName },
      }),
      db.studentProfile.update({
        where: { id: profile.id },
        data: { batch: input.batch, universityName: input.universityName },
      }),
      db.auditLog.create({
        data: {
          actorId: actor.data.id,
          action: "STUDENT_UPDATED",
          targetType: "USER",
          targetId: userId,
          detail: "Updated name, batch, and university.",
        },
      }),
    ]);
  } catch {
    logError("admin.student_update_failed", { actorId: actor.data.id });
    return adminInvalid("The student could not be updated. Try again.");
  }

  return { ok: true, data: { id: userId } };
}

export async function setAccountActive(
  actorId: string,
  userId: string,
  active: boolean,
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (userId === actor.data.id) {
    return adminInvalid("You cannot change your own account.");
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Account not found.");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deactivatedAt: true },
  });

  if (!target || (target.role !== "STUDENT" && target.role !== "MENTOR")) {
    return adminInvalid("Account not found.");
  }

  if (active && !target.deactivatedAt) {
    return adminInvalid("This account is already active.");
  }

  if (!active && target.deactivatedAt) {
    return adminInvalid("This account is already deactivated.");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { deactivatedAt: active ? null : new Date() },
    });

    if (!active) {
      await tx.session.deleteMany({ where: { userId: target.id } });
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.data.id,
        action: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
        targetType: "USER",
        targetId: target.id,
        detail: `${target.role} account`,
      },
    });
  });

  return { ok: true, data: { id: target.id } };
}

export async function listMentors(
  actorId: string,
  query: {
    page: number;
    search: string;
    account: "all" | "active" | "deactivated";
    approval: "all" | "PENDING" | "APPROVED" | "REJECTED";
  },
): Promise<AdminSuccess<AdminPage<MentorListItem>> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const search = query.search.trim().slice(0, 80);
  const where = mentorWhere(search, query.account, query.approval);
  const total = await db.user.count({ where });
  const page = clampPage(query.page, total);
  const users = await db.user.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deactivatedAt: true,
      mentorProfile: {
        select: { id: true, employeeId: true, approvalStatus: true, batch: true, universityName: true },
      },
    },
  });

  return {
    ok: true,
    data: {
      items: users.flatMap((user) => {
        if (!user.mentorProfile) {
          return [];
        }
        return [
          {
            id: user.id,
            profileId: user.mentorProfile.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            employeeId: user.mentorProfile.employeeId,
            batch: user.mentorProfile.batch,
            universityName: user.mentorProfile.universityName,
            approvalStatus: user.mentorProfile.approvalStatus,
            deactivatedAt: user.deactivatedAt,
          },
        ];
      }),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    },
  };
}

export async function getMentor(
  actorId: string,
  userId: string,
): Promise<AdminSuccess<MentorDetail> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Mentor not found.");
  }

  const user = await db.user.findFirst({
    where: { id: userId, role: "MENTOR" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deactivatedAt: true,
      githubAccount: { select: { username: true } },
      mentorProfile: {
        select: {
          id: true,
          employeeId: true,
          approvalStatus: true,
          batch: true,
          universityName: true,
          techStacks: { select: { techStackId: true } },
        },
      },
    },
  });

  if (!user?.mentorProfile) {
    return adminInvalid("Mentor not found.");
  }

  const selectedIds = user.mentorProfile.techStacks.map((stack) => stack.techStackId);
  const techStacks = await db.techStack.findMany({
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true },
  });
  const missing = selectedIds.filter((id) => !techStacks.some((stack) => stack.id === id));
  const extra =
    missing.length > 0
      ? await db.techStack.findMany({
          where: { id: { in: missing } },
          select: { id: true, name: true },
        })
      : [];

  return {
    ok: true,
    data: {
      id: user.id,
      profileId: user.mentorProfile.id,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.mentorProfile.employeeId,
      batch: user.mentorProfile.batch,
      universityName: user.mentorProfile.universityName,
      approvalStatus: user.mentorProfile.approvalStatus,
      deactivatedAt: user.deactivatedAt,
      githubUsername: user.githubAccount?.username ?? null,
      techStackIds: selectedIds,
      techStacks: [...techStacks, ...extra].sort((left, right) => left.name.localeCompare(right.name)),
    },
  };
}

export async function updateMentor(
  actorId: string,
  userId: string,
  input: MentorUpdate,
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Mentor not found.");
  }

  const profile = await db.mentorProfile.findUnique({
    where: { userId },
    select: { id: true, user: { select: { role: true } } },
  });

  if (!profile || profile.user.role !== "MENTOR") {
    return adminInvalid("Mentor not found.");
  }

  const techStackIds = [...new Set(input.techStackIds)];
  if (techStackIds.length > 0) {
    const found = await db.techStack.count({ where: { id: { in: techStackIds } } });
    if (found !== techStackIds.length) {
      return adminInvalid("Choose a tech stack that exists.", {
        techStackIds: ["Choose a tech stack that exists."],
      });
    }
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName },
    });
    await tx.mentorProfile.update({
      where: { id: profile.id },
      data: { batch: input.batch, universityName: input.universityName },
    });
    await tx.mentorTechStack.deleteMany({ where: { mentorId: profile.id } });
    if (techStackIds.length > 0) {
      await tx.mentorTechStack.createMany({
        data: techStackIds.map((techStackId) => ({ mentorId: profile.id, techStackId })),
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.data.id,
        action: "MENTOR_UPDATED",
        targetType: "USER",
        targetId: userId,
        detail: `Updated profile and ${techStackIds.length} tech stacks.`,
      },
    });
  });

  return { ok: true, data: { id: userId } };
}

export async function decideMentor(
  actorId: string,
  userId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<AdminSuccess<{ id: string }> | AdminError> {
  const actor = await requireAdminActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  if (!parseUuid(userId)) {
    return adminInvalid("Mentor not found.");
  }

  const profile = await db.mentorProfile.findUnique({
    where: { userId },
    select: { id: true, approvalStatus: true, user: { select: { role: true } } },
  });

  if (!profile || profile.user.role !== "MENTOR") {
    return adminInvalid("Mentor not found.");
  }

  if (profile.approvalStatus === decision) {
    return adminInvalid(
      decision === "APPROVED" ? "This mentor is already approved." : "This mentor is already rejected.",
    );
  }

  await db.$transaction([
    db.mentorProfile.update({
      where: { id: profile.id },
      data: { approvalStatus: decision },
    }),
    db.auditLog.create({
      data: {
        actorId: actor.data.id,
        action: decision === "APPROVED" ? "MENTOR_APPROVED" : "MENTOR_REJECTED",
        targetType: "USER",
        targetId: userId,
        detail: decision,
      },
    }),
  ]);

  return { ok: true, data: { id: userId } };
}
