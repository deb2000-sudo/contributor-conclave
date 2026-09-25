import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/cookie";
import { publicUserSelect, type PublicUser } from "@/lib/auth/types";

function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { ...publicUserSelect, deactivatedAt: true } },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date() || session.user.deactivatedAt) {
    await db.session.delete({ where: { id: session.id } });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return {
    id: session.user.id,
    role: session.user.role,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    email: session.user.email,
  };
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}
