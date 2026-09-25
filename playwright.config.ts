import { defineConfig } from "@playwright/test";

import { TEST_MESSAGE_KEY } from "./src/test/constants";
import { TEST_DATABASE_URL } from "./src/test/database-url";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev --hostname localhost --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      MESSAGE_ENCRYPTION_KEY: TEST_MESSAGE_KEY,
      E2E_GITHUB_FIXTURE: "1",
      GITHUB_TOKEN: "",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
