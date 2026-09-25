import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function datasourceUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    return configured;
  }

  // `prisma generate` does not open a connection. The image build has no database URL.
  if (process.argv.includes("generate")) {
    return "postgresql://127.0.0.1:5432/contributor_conclave";
  }

  return env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
