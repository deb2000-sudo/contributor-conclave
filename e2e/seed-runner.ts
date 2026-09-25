import { db } from "../src/lib/db";
import { prepareTestDatabase } from "../src/test/prepare-database";
import { seedE2E } from "../src/test/seed";

async function main() {
  prepareTestDatabase();
  await seedE2E();
  await db.$disconnect();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "End-to-end seed failed.";
  console.error(message);
  process.exit(1);
});
