import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as currentSession } from "@/app/api/auth/session/route";
import { db } from "@/lib/db";
import {
  requireAdmin,
  requireAuth,
  requireMentor,
  requireStudent,
} from "@/lib/auth/authorization";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { resetAuthThrottle } from "@/lib/auth/throttle";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

const cookieStore = vi.hoisted(() => {
  return new Map<string, { value: string; options?: Record<string, unknown> }>();
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const entry = cookieStore.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      cookieStore.set(name, { value, options });
    },
    delete(name: string) {
      cookieStore.delete(name);
    },
  }),
}));

const password = "Sup3r-secret!";

function uniqueId() {
  return randomUUID().slice(0, 8);
}

function studentPayload(id = uniqueId()) {
  return {
    role: "STUDENT",
    firstName: "Ada",
    lastName: "Lovelace",
    email: `student-${id}@auth-test.example`,
    niatId: `niat-${id}`,
    batch: "Batch 1",
    universityName: "Example University",
    githubUsername: `student-${id}`,
    password,
    confirmPassword: password,
  };
}

function mentorPayload(id = uniqueId()) {
  return {
    role: "MENTOR",
    firstName: "Grace",
    lastName: "Hopper",
    email: `mentor-${id}@auth-test.example`,
    employeeId: `emp-${id}`,
    batch: "Batch 1",
    universityName: "Example University",
    githubUsername: `mentor-${id}`,
    password,
    confirmPassword: password,
  };
}

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieStore.clear();
  resetAuthThrottle();
});

afterEach(async () => {
  await db.user.deleteMany({
    where: { email: { endsWith: "@auth-test.example" } },
  });
});

describe("registration", () => {
  it("creates a student and stores only a password hash", async () => {
    const payload = studentPayload();
    const response = await register(post("http://localhost/api/auth/register", payload));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.role).toBe("STUDENT");
    expect(body.user.email).toBe(payload.email);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain(password);

    const saved = await db.user.findUniqueOrThrow({
      where: { email: payload.email },
    });
    expect(saved.passwordHash).not.toBe(password);
    expect(saved.passwordHash.startsWith("$argon2id$")).toBe(true);

    const cookie = cookieStore.get(SESSION_COOKIE);
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    const session = await db.session.findFirstOrThrow({
      where: { userId: saved.id },
    });
    expect(session.tokenHash).not.toBe(cookie?.value);
  });

  it("creates a mentor account", async () => {
    const payload = mentorPayload();
    const response = await register(post("http://localhost/api/auth/register", payload));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.role).toBe("MENTOR");
    expect(body.user.role).not.toBe("ADMIN");
  });

  it("rejects admin registration from the browser", async () => {
    const payload = { ...studentPayload(), role: "ADMIN" };
    const response = await register(post("http://localhost/api/auth/register", payload));

    expect(response.status).toBe(400);
    await expect(db.user.count({ where: { email: payload.email } })).resolves.toBe(0);
  });

  it("rejects duplicate email, NIAT ID, employee ID, and GitHub username", async () => {
    const first = studentPayload("dup");
    expect((await register(post("http://localhost/api/auth/register", first))).status).toBe(201);

    const sameEmail = await register(
      post("http://localhost/api/auth/register", {
        ...studentPayload("other"),
        email: first.email.toUpperCase(),
      }),
    );
    expect(sameEmail.status).toBe(409);
    expect((await sameEmail.json()).fieldErrors.email[0]).toMatch(/email/i);

    const sameNiat = await register(
      post("http://localhost/api/auth/register", {
        ...studentPayload("niat"),
        niatId: first.niatId.toUpperCase(),
      }),
    );
    expect(sameNiat.status).toBe(409);

    const sameGithub = await register(
      post("http://localhost/api/auth/register", {
        ...mentorPayload("gh"),
        githubUsername: first.githubUsername.toUpperCase(),
      }),
    );
    expect(sameGithub.status).toBe(409);

    const mentor = mentorPayload("mentor-dup");
    expect((await register(post("http://localhost/api/auth/register", mentor))).status).toBe(201);
    const sameEmployee = await register(
      post("http://localhost/api/auth/register", {
        ...mentorPayload("mentor-other"),
        employeeId: mentor.employeeId,
      }),
    );
    expect(sameEmployee.status).toBe(409);
  });

  it("rejects mismatched passwords", async () => {
    const response = await register(
      post("http://localhost/api/auth/register", {
        ...studentPayload(),
        confirmPassword: "Different-1!",
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("login, logout, and session", () => {
  it("logs in with valid credentials and rejects invalid ones", async () => {
    const payload = studentPayload();
    await register(post("http://localhost/api/auth/register", payload));
    cookieStore.clear();

    const wrong = await login(
      post("http://localhost/api/auth/login", {
        email: payload.email,
        password: "Wrong-password-1!",
      }),
    );
    const unknown = await login(
      post("http://localhost/api/auth/login", {
        email: "missing@auth-test.example",
        password,
      }),
    );

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).error).toBe((await unknown.json()).error);
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);

    const success = await login(
      post("http://localhost/api/auth/login", {
        email: payload.email,
        password,
      }),
    );
    const body = await success.json();

    expect(success.status).toBe(200);
    expect(body.user.role).toBe("STUDENT");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("returns the current user and clears it on logout", async () => {
    const payload = studentPayload();
    await register(post("http://localhost/api/auth/register", payload));

    const session = await currentSession();
    const sessionBody = await session.json();
    expect(session.status).toBe(200);
    expect(sessionBody.user.email).toBe(payload.email);
    expect(sessionBody.user.role).toBe("STUDENT");
    expect(JSON.stringify(sessionBody)).not.toContain("passwordHash");

    const loggedOut = await logout();
    expect(loggedOut.status).toBe(200);
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);

    const after = await currentSession();
    expect(after.status).toBe(401);
    await expect(db.session.count({ where: { user: { email: payload.email } } })).resolves.toBe(0);
  });

  it("rejects a request with no session", async () => {
    const response = await currentSession();
    expect(response.status).toBe(401);
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("role authorization", () => {
  it("uses the database role and ignores a client-supplied role", async () => {
    const payload = studentPayload();
    await register(post("http://localhost/api/auth/register", payload));

    const session = await currentSession();
    const url = new URL("http://localhost/api/auth/session?role=ADMIN");
    expect(url.searchParams.get("role")).toBe("ADMIN");
    expect((await session.json()).user.role).toBe("STUDENT");

    await expect(requireStudent()).resolves.toMatchObject({ role: "STUDENT" });
    await expect(requireMentor()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows a mentor only through requireMentor", async () => {
    await register(post("http://localhost/api/auth/register", mentorPayload()));

    await expect(requireMentor()).resolves.toMatchObject({ role: "MENTOR" });
    await expect(requireStudent()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite lax, and secure in production", () => {
    expect(sessionCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    expect(sessionCookieOptions("development").secure).toBe(false);
  });
});
