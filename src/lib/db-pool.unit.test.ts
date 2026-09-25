import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_POOL_MAX,
  MAX_POOL_MAX,
  POOL_APPLICATION_NAME,
  POOL_CONNECTION_TIMEOUT_MS,
  POOL_IDLE_TIMEOUT_MS,
  POOL_MAX_LIFETIME_SECONDS,
  createPoolConfig,
  readPoolMax,
} from "@/lib/db-pool";

const originalPoolMax = process.env.DATABASE_POOL_MAX;

afterEach(() => {
  if (originalPoolMax === undefined) {
    delete process.env.DATABASE_POOL_MAX;
  } else {
    process.env.DATABASE_POOL_MAX = originalPoolMax;
  }
});

describe("database pool size", () => {
  it("uses a small default when the setting is absent", () => {
    delete process.env.DATABASE_POOL_MAX;
    expect(readPoolMax()).toBe(DEFAULT_POOL_MAX);
    expect(readPoolMax("")).toBe(DEFAULT_POOL_MAX);
    expect(readPoolMax("  ")).toBe(DEFAULT_POOL_MAX);
  });

  it("accepts an integer inside the per-instance ceiling", () => {
    expect(readPoolMax("1")).toBe(1);
    expect(readPoolMax(` ${MAX_POOL_MAX} `)).toBe(MAX_POOL_MAX);
  });

  it("rejects zero, fractions, and values above the ceiling", () => {
    expect(() => readPoolMax("0")).toThrow(/1 to 10/);
    expect(() => readPoolMax("2.5")).toThrow(/1 to 10/);
    expect(() => readPoolMax("11")).toThrow(/1 to 10/);
    expect(() => readPoolMax("nope")).toThrow(/1 to 10/);
  });

  it("builds a pool that releases idle connections and names the application", () => {
    const config = createPoolConfig("postgresql://local/contributor_conclave", 4);

    expect(config).toMatchObject({
      connectionString: "postgresql://local/contributor_conclave",
      max: 4,
      min: 0,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
      maxLifetimeSeconds: POOL_MAX_LIFETIME_SECONDS,
      application_name: POOL_APPLICATION_NAME,
    });
  });
});
