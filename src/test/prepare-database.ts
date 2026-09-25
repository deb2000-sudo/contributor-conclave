import { execSync } from "node:child_process";

import { TEST_DATABASE_URL } from "./database-url";

/** Creates the local test database if needed and applies migrations. Never touches production. */
export function prepareTestDatabase() {
  if (process.env.TEST_DATABASE_PROVISIONED === "1") {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "inherit",
    });
    return;
  }

  const exists = execSync(
    `docker exec contributor-conclave-postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'contributor_conclave_test'"`,
    { encoding: "utf8" },
  ).trim();

  if (exists !== "1") {
    execSync(
      `docker exec contributor-conclave-postgres psql -U postgres -c "CREATE DATABASE contributor_conclave_test"`,
    );
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
