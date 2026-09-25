import path from "node:path";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./src/test/database-url";
import { TEST_MESSAGE_KEY } from "./src/test/constants";

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
};

const coverage = {
  provider: "v8" as const,
  reporter: ["text", "html"],
  include: ["src/lib/**/*.ts"],
  exclude: [
    "src/generated/**",
    "src/test/**",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.unit.test.ts",
    "src/**/*.unit.test.tsx",
    "src/**/*.integration.test.ts",
  ],
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.unit.test.ts", "src/**/*.unit.test.tsx"],
          env: {
            // Present so modules can load. Unit tests do not open a database.
            DATABASE_URL: "postgresql://unit:unit@127.0.0.1:1/unit",
            MESSAGE_ENCRYPTION_KEY: TEST_MESSAGE_KEY,
          },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          fileParallelism: false,
          globalSetup: "./src/test/global-setup.ts",
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            MESSAGE_ENCRYPTION_KEY: TEST_MESSAGE_KEY,
          },
        },
      },
    ],
  },
});
