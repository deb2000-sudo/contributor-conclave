import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
const LOGIN_ADDRESS_LIMIT = 32;
const REGISTER_LIMIT = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function withinLimit(key: string, limit: number, now: number): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    return true;
  }
  return current.count < limit;
}

function record(key: string, now: number) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** Cloud Run appends the caller address. Use that hop, not a client-supplied prefix. */
export function clientAddress(forwardedFor: string | null): string {
  if (!forwardedFor) {
    return "unknown";
  }
  const parts = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? "unknown";
}

export function loginAttemptAllowed(email: string, address: string, now = Date.now()): boolean {
  return (
    withinLimit(`login:email:${emailKey(email)}`, LOGIN_LIMIT, now) &&
    withinLimit(`login:address:${address}`, LOGIN_ADDRESS_LIMIT, now)
  );
}

export function recordLoginFailure(email: string, address: string, now = Date.now()) {
  record(`login:email:${emailKey(email)}`, now);
  record(`login:address:${address}`, now);
}

export function registrationAllowed(address: string, now = Date.now()): boolean {
  return withinLimit(`register:address:${address}`, REGISTER_LIMIT, now);
}

export function recordRegistration(address: string, now = Date.now()) {
  record(`register:address:${address}`, now);
}

export function resetAuthThrottle() {
  buckets.clear();
}

export const AUTH_LIMIT_MESSAGE = "Too many attempts. Wait a few minutes and try again.";
