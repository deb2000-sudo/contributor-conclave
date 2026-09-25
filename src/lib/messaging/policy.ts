import { z } from "zod";

export const MESSAGE_PAGE_SIZE = 20;
export const MESSAGE_RATE_LIMIT = 20;
export const MESSAGE_RATE_WINDOW_MS = 60_000;

const unsupportedCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a message." })
  .max(2000, { error: "Message must be 2000 characters or fewer." })
  .refine((value) => !unsupportedCharacters.test(value), {
    error: "Message contains unsupported characters.",
  });

export function rateLimitAllows(recentCount: number, limit = MESSAGE_RATE_LIMIT): boolean {
  return recentCount < limit;
}

export function parseMessageBody(
  input: unknown,
): { ok: true; data: string } | { ok: false; message: string; fieldErrors: { body: string[] } } {
  const parsed = messageBodySchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { ok: false, message: messages[0] ?? "Enter a message.", fieldErrors: { body: messages } };
  }
  return { ok: true, data: parsed.data };
}
