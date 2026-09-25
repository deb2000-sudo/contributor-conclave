import type { PoolConfig } from "pg";

/** Connections one process may hold. Each Cloud Run instance is one process. */
export const DEFAULT_POOL_MAX = 5;

/** Upper bound so one instance cannot exhaust Cloud SQL by itself. */
export const MAX_POOL_MAX = 10;

export const POOL_IDLE_TIMEOUT_MS = 10_000;
export const POOL_CONNECTION_TIMEOUT_MS = 10_000;
export const POOL_STATEMENT_TIMEOUT_MS = 15_000;
export const POOL_IDLE_TRANSACTION_TIMEOUT_MS = 15_000;
export const POOL_MAX_LIFETIME_SECONDS = 600;
export const POOL_APPLICATION_NAME = "contributor-conclave";

export function readPoolMax(value = process.env.DATABASE_POOL_MAX): number {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return DEFAULT_POOL_MAX;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_POOL_MAX) {
    throw new Error(`DATABASE_POOL_MAX must be an integer from 1 to ${MAX_POOL_MAX}.`);
  }

  return parsed;
}

export function createPoolConfig(connectionString: string, poolMax = readPoolMax()): PoolConfig {
  return {
    connectionString,
    max: poolMax,
    min: 0,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    maxLifetimeSeconds: POOL_MAX_LIFETIME_SECONDS,
    statement_timeout: POOL_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: POOL_IDLE_TRANSACTION_TIMEOUT_MS,
    application_name: POOL_APPLICATION_NAME,
  };
}
