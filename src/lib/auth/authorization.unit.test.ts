import { describe, expect, it } from "vitest";

import { homeForRole } from "@/lib/auth/authorization";
import { sessionCookieOptions } from "@/lib/auth/cookie";

describe("authorization helpers", () => {
  it("sends each role to its own workspace", () => {
    expect(homeForRole("STUDENT")).toBe("/student");
    expect(homeForRole("MENTOR")).toBe("/mentor");
    expect(homeForRole("ADMIN")).toBe("/admin");
  });

  it("keeps the session cookie HttpOnly and marks it secure only in production", () => {
    expect(sessionCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    expect(sessionCookieOptions("development").secure).toBe(false);
    expect(sessionCookieOptions("test").secure).toBe(false);
  });
});
