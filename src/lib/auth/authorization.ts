import { redirect } from "next/navigation";

import type { Role } from "@/generated/prisma/client";

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { getCurrentUser } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/auth/types";

export function homeForRole(role: Role): "/student" | "/mentor" | "/admin" {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "MENTOR":
      return "/mentor";
    case "ADMIN":
      return "/admin";
  }
}

export async function requireAuth(): Promise<PublicUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function requireRole(roles: Role | readonly Role[]): Promise<PublicUser> {
  const user = await requireAuth();
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!allowed.includes(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}

export function requireStudent(): Promise<PublicUser> {
  return requireRole("STUDENT");
}

export function requireMentor(): Promise<PublicUser> {
  return requireRole("MENTOR");
}

export function requireAdmin(): Promise<PublicUser> {
  return requireRole("ADMIN");
}

export async function enforcePageRole(role: Role): Promise<PublicUser> {
  try {
    return await requireRole(role);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }

    if (error instanceof ForbiddenError) {
      redirect("/forbidden");
    }

    throw error;
  }
}
