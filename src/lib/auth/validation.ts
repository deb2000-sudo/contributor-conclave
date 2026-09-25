import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a name." })
  .max(80, { error: "Name must be 80 characters or fewer." });

const emailSchema = z
  .string()
  .trim()
  .max(254, { error: "Email must be 254 characters or fewer." })
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform((email) => email.toLowerCase());

export const batchSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a batch." })
  .max(120, { error: "Batch must be 120 characters or fewer." });

export const universitySchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a university name." })
  .max(160, { error: "University name must be 160 characters or fewer." });

const identifierSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter a ${label}.` })
    .max(64, { error: `${label} must be 64 characters or fewer.` });

export const githubUsernameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a GitHub username." })
  .max(39, { error: "GitHub usernames are at most 39 characters." })
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/, {
    error: "Enter a valid GitHub username.",
  })
  .transform((username) => username.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, { error: "Be at least 8 characters long." })
  .max(128, { error: "Be at most 128 characters long." })
  .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
  .regex(/[0-9]/, { error: "Contain at least one number." })
  .regex(/[^a-zA-Z0-9]/, { error: "Contain at least one special character." });

function matchPasswords(value: { password: string; confirmPassword: string }) {
  return value.password === value.confirmPassword;
}

const passwordMatch = {
  path: ["confirmPassword"],
  error: "Passwords do not match.",
};

export const studentRegistrationSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    niatId: identifierSchema("NIAT ID"),
    batch: batchSchema,
    universityName: universitySchema,
    githubUsername: githubUsernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(matchPasswords, passwordMatch);

export const mentorRegistrationSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    employeeId: identifierSchema("employee ID"),
    batch: batchSchema,
    universityName: universitySchema,
    githubUsername: githubUsernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(matchPasswords, passwordMatch);

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { error: "Enter your password." })
    .max(128, { error: "Password must be 128 characters or fewer." }),
});

export type StudentRegistration = z.infer<typeof studentRegistrationSchema>;
export type MentorRegistration = z.infer<typeof mentorRegistrationSchema>;

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field !== "string") {
      continue;
    }

    result[field] ??= [];
    result[field].push(issue.message);
  }

  return result;
}
