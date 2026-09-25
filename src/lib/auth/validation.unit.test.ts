import { describe, expect, it } from "vitest";

import { loginSchema, passwordSchema, studentRegistrationSchema } from "@/lib/auth/validation";

const student = {
  firstName: "Sita",
  lastName: "Student",
  email: "Sita@Example.test",
  niatId: "NIAT-1",
  batch: "2026",
  universityName: "Example University",
  githubUsername: "Sita-Student",
  password: "Test-password-1",
  confirmPassword: "Test-password-1",
};

describe("registration and login validation", () => {
  it("requires a letter, number, and special character in a password", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("longpassword").success).toBe(false);
    expect(passwordSchema.safeParse("longpassword1").success).toBe(false);
    expect(passwordSchema.safeParse("Test-password-1").success).toBe(true);
  });

  it("lowercases email and GitHub username and rejects a mismatched confirmation", () => {
    const parsed = studentRegistrationSchema.safeParse(student);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("sita@example.test");
      expect(parsed.data.githubUsername).toBe("sita-student");
    }

    const mismatch = studentRegistrationSchema.safeParse({
      ...student,
      confirmPassword: "Other-password-1",
    });
    expect(mismatch.success).toBe(false);
  });

  it("rejects an empty login password", () => {
    expect(loginSchema.safeParse({ email: "sita@example.test", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
});
