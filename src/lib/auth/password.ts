import { hash, verify } from "@node-rs/argon2";

// Argon2id is the library default and the OWASP recommendation.
const options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, options);
  } catch {
    return false;
  }
}
