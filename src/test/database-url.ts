const localTestDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/contributor_conclave_test";

/** Local Docker by default. Cloud Build sets this to its ephemeral Postgres service. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() || localTestDatabaseUrl;
