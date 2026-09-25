import { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { publicUserSelect, type PublicUser } from "@/lib/auth/types";
import type {
  MentorRegistration,
  StudentRegistration,
} from "@/lib/auth/validation";

export type AuthFailure = {
  ok: false;
  status: 400 | 401 | 403 | 409 | 500;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

export type AuthSuccess = {
  ok: true;
  user: PublicUser;
};

let dummyPasswordHash: Promise<string> | undefined;

function duplicateFailure(error: Prisma.PrismaClientKnownRequestError): AuthFailure {
  const target = error.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : [String(target ?? "")];
  const joined = `${fields.join(" ")} ${error.message}`;

  if (joined.includes("email")) {
    return {
      ok: false,
      status: 409,
      fieldErrors: { email: ["An account with this email already exists."] },
    };
  }

  if (joined.includes("niat_id")) {
    return {
      ok: false,
      status: 409,
      fieldErrors: { niatId: ["This NIAT ID is already registered."] },
    };
  }

  if (joined.includes("employee_id")) {
    return {
      ok: false,
      status: 409,
      fieldErrors: { employeeId: ["This employee ID is already registered."] },
    };
  }

  if (joined.includes("username")) {
    return {
      ok: false,
      status: 409,
      fieldErrors: {
        githubUsername: ["This GitHub username is already registered."],
      },
    };
  }

  logError("registration_duplicate_unmapped", { code: "P2002" });

  return {
    ok: false,
    status: 409,
    formError: "An account with these details already exists.",
  };
}

function registrationError(error: unknown): AuthFailure {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return duplicateFailure(error);
  }

  logError("registration_failed", {
    name: error instanceof Error ? error.name : "unknown",
  });

  return {
    ok: false,
    status: 500,
    formError: "Could not create the account.",
  };
}

export async function registerStudent(
  input: StudentRegistration,
): Promise<AuthSuccess | AuthFailure> {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          role: "STUDENT",
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash,
        },
        select: publicUserSelect,
      });

      await tx.studentProfile.create({
        data: {
          userId: created.id,
          niatId: input.niatId,
          batch: input.batch,
          universityName: input.universityName,
        },
      });

      await tx.gitHubAccount.create({
        data: {
          userId: created.id,
          username: input.githubUsername,
        },
      });

      return created;
    });

    return { ok: true, user };
  } catch (error) {
    return registrationError(error);
  }
}

export async function registerMentor(
  input: MentorRegistration,
): Promise<AuthSuccess | AuthFailure> {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          role: "MENTOR",
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash,
        },
        select: publicUserSelect,
      });

      await tx.mentorProfile.create({
        data: {
          userId: created.id,
          employeeId: input.employeeId,
          batch: input.batch,
          universityName: input.universityName,
        },
      });

      await tx.gitHubAccount.create({
        data: {
          userId: created.id,
          username: input.githubUsername,
        },
      });

      return created;
    });

    return { ok: true, user };
  } catch (error) {
    return registrationError(error);
  }
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthSuccess | AuthFailure> {
  const user = await db.user.findUnique({
    where: { email },
    select: { ...publicUserSelect, passwordHash: true, deactivatedAt: true },
  });

  const passwordHash = user
    ? user.passwordHash
    : await (dummyPasswordHash ??= hashPassword("not-a-real-account-password"));

  const valid = await verifyPassword(passwordHash, password);

  if (!user || !valid) {
    return {
      ok: false,
      status: 401,
      formError: "Invalid email or password.",
    };
  }

  if (user.deactivatedAt) {
    return {
      ok: false,
      status: 403,
      formError: "This account is deactivated.",
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  };
}
