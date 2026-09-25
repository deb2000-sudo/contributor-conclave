import "dotenv/config";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

const ADMIN_EMAIL = "bhavana.panchothi@nxtwave.co.in";

function assertLocalDatabase() {
  const configured = process.env.DATABASE_URL?.trim();
  if (!configured) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and start PostgreSQL.");
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL.");
  }

  const database = url.pathname.replace(/^\//, "");
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!localHost || database !== "contributor_conclave") {
    throw new Error("This seed runs only against the local contributor_conclave database.");
  }
}

async function main() {
  assertLocalDatabase();

  const password = process.env.ADMIN_SEED_PASSWORD ?? "";
  if (!password) {
    throw new Error("Set ADMIN_SEED_PASSWORD for this run. Do not store the password in the seed file.");
  }

  const passwordHash = await hashPassword(password);
  const existing = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });

  if (existing) {
    await db.$transaction([
      db.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", passwordHash, deactivatedAt: null },
      }),
      db.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log("Updated the existing account to ADMIN.");
  } else {
    await db.user.create({
      data: {
        role: "ADMIN",
        firstName: "Bhavana",
        lastName: "Panchothi",
        email: ADMIN_EMAIL,
        passwordHash,
      },
    });
    console.log("Created the ADMIN account.");
  }

  const saved = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { role: true, deactivatedAt: true },
  });

  if (saved?.role !== "ADMIN" || saved.deactivatedAt) {
    throw new Error("The admin account was not saved.");
  }

  console.log(`ADMIN is ready for ${ADMIN_EMAIL}.`);
  await db.$disconnect();
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Admin seed failed.";
  console.error(message);
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
