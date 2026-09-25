import { afterEach, describe, expect, it } from "vitest";

import { createGitHubService } from "@/lib/github/service";
import { e2eGitHubOptions } from "@/lib/github/fixture";

const previousFlag = process.env.E2E_GITHUB_FIXTURE;
const previousNodeEnv = process.env.NODE_ENV;

function assignNodeEnv(value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
    return;
  }
  Reflect.set(process.env, "NODE_ENV", value);
}

afterEach(() => {
  if (previousFlag === undefined) {
    delete process.env.E2E_GITHUB_FIXTURE;
  } else {
    process.env.E2E_GITHUB_FIXTURE = previousFlag;
  }
  assignNodeEnv(previousNodeEnv);
});

describe("github end-to-end fixture", () => {
  it("stays off unless the end-to-end flag is set outside production", () => {
    delete process.env.E2E_GITHUB_FIXTURE;
    assignNodeEnv("test");
    expect(e2eGitHubOptions()).toBeUndefined();

    process.env.E2E_GITHUB_FIXTURE = "1";
    assignNodeEnv("production");
    expect(e2eGitHubOptions()).toBeUndefined();
  });

  it("returns a pull request authored by the repository owner without calling GitHub", async () => {
    process.env.E2E_GITHUB_FIXTURE = "1";
    assignNodeEnv("test");
    const options = e2eGitHubOptions();
    expect(options?.token).toBe("e2e-fixture");

    const github = createGitHubService(options);
    const result = await github.validatePullRequestUrl("https://github.com/seedstudent/demo/pull/2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pullRequest.authorLogin).toBe("seedstudent");
      expect(result.data.url).toBe("https://github.com/seedstudent/demo/pull/2");
    }
    expect(JSON.stringify(result)).not.toContain("e2e-fixture");
  });
});
