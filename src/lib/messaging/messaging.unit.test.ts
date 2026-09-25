import { describe, expect, it } from "vitest";

import { decryptMessageBody, encryptMessageBody, openStoredMessage } from "@/lib/messaging/crypto";
import { messageBodySchema, rateLimitAllows } from "@/lib/messaging/policy";

describe("message protection", () => {
  it("encrypts stored text and still decrypts it for the server", () => {
    const stored = encryptMessageBody("Look at the diff.");
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("Look at the diff.");
    expect(decryptMessageBody(stored)).toBe("Look at the diff.");
    expect(decryptMessageBody("legacy plaintext")).toBe("legacy plaintext");
  });

  it("rejects a tampered payload and leaves end-to-end payloads opaque", () => {
    const stored = encryptMessageBody("secret");
    const [version, iv, ciphertext, tag] = stored.split(".");
    expect(() => decryptMessageBody([version, iv, ciphertext, `${tag}x`].join("."))).toThrow();
    expect(openStoredMessage("E2EE", stored)).toEqual({ text: null });
    expect(openStoredMessage("SERVER", stored)).toEqual({ text: "secret" });
  });

  it("limits message size, control characters, and send rate", () => {
    expect(messageBodySchema.safeParse("  Hello  ").data).toBe("Hello");
    expect(messageBodySchema.safeParse(" ").success).toBe(false);
    expect(messageBodySchema.safeParse("a".repeat(2001)).success).toBe(false);
    expect(messageBodySchema.safeParse("hello\u0000").success).toBe(false);
    expect(messageBodySchema.safeParse("line one\nline two").success).toBe(true);
    expect(rateLimitAllows(19)).toBe(true);
    expect(rateLimitAllows(20)).toBe(false);
  });
});
