import { db } from "@/lib/db";

export type AdminActor = { id: string };

export type AdminError = {
  ok: false;
  code: "unauthenticated" | "forbidden" | "invalid";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type AdminSuccess<T> = { ok: true; data: T };

export async function requireAdminActor(userId: string): Promise<AdminSuccess<AdminActor> | AdminError> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deactivatedAt: true },
  });

  if (!user) {
    return { ok: false, code: "unauthenticated", message: "Authentication required." };
  }

  if (user.role !== "ADMIN" || user.deactivatedAt) {
    return { ok: false, code: "forbidden", message: "You do not have access to this resource." };
  }

  return { ok: true, data: { id: user.id } };
}

export function adminInvalid(message: string, fieldErrors?: Record<string, string[]>): AdminError {
  return { ok: false, code: "invalid", message, fieldErrors };
}
