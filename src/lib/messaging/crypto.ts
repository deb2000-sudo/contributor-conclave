import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const version = "v1";

function encryptionKey(): Buffer {
  const decoded = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64");
  if (decoded.length !== 32) {
    throw new Error("MESSAGE_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  }
  return decoded;
}

/** Encrypts a message for storage. The server can still decrypt it for participants. This is not end-to-end encryption. */
export function encryptMessageBody(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [version, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptMessageBody(stored: string): string {
  if (!stored.startsWith(`${version}.`)) {
    return stored;
  }

  const parts = stored.split(".");
  if (parts.length !== 4) {
    throw new Error("Stored message could not be read.");
  }

  const iv = Buffer.from(parts[1] ?? "", "base64url");
  const ciphertext = Buffer.from(parts[2] ?? "", "base64url");
  const tag = Buffer.from(parts[3] ?? "", "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** SERVER messages are decrypted for an authorized participant. E2EE payloads stay opaque. */
export function openStoredMessage(
  protection: "SERVER" | "E2EE",
  stored: string,
): { text: string | null } {
  if (protection === "E2EE") {
    return { text: null };
  }
  return { text: decryptMessageBody(stored) };
}
