import { execFileSync } from "node:child_process";

import { TEST_MESSAGE_KEY } from "../src/test/constants";
import { TEST_DATABASE_URL } from "../src/test/database-url";

export default function globalSetup() {
  execFileSync("npx", ["tsx", "e2e/seed-runner.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      MESSAGE_ENCRYPTION_KEY: TEST_MESSAGE_KEY,
      E2E_GITHUB_FIXTURE: "1",
      GITHUB_TOKEN: "",
    },
  });
}
