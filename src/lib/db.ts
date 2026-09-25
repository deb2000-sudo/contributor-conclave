import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { createPoolConfig } from "@/lib/db-pool";

const globalForDb = globalThis as unknown as {
  db: PrismaClient | undefined;
};

function createDb() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start PostgreSQL with npm run db:up.",
    );
  }

  const adapter = new PrismaPg(createPoolConfig(connectionString));
  return new PrismaClient({ adapter });
}

function getDb(): PrismaClient {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }

  return globalForDb.db;
}

// The client is created on the first query.
// Next collects route modules during `next build`, and Cloud Run starts the
// process before a database URL is required. One client is reused so hot
// reload in development does not exhaust PostgreSQL connections.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
