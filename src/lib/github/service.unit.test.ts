import { describe, expect, it, vi } from "vitest";

import type { GitHubFetcher } from "@/lib/github/client";
import { createGitHubService } from "@/lib/github/service";

const token = "ghp_test_token_should_stay_on_the_server";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function serviceWith(fetchImpl: GitHubFetcher, options?: { token?: string | null; now?: () => number }) {
  return createGitHubService({
    fetchImpl,
    token: options && "token" in options ? options.token : token,
    now: options?.now,
  });
}

describe("github service", () => {
  it("rejects an invalid username without calling GitHub", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    const github = serviceWith(fetchImpl);

    const result = await github.getProfile("not a user");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_account");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a profile and keeps the token out of the result", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse({
        login: "octocat",
        name: "The Octocat",
        public_repos: 8,
        html_url: "https://github.com/octocat",
      }),
    );
    const github = serviceWith(fetchImpl, { token });

    const result = await github.getProfile("Octocat");
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(headers.get("authorization")).toBe(`Bearer ${token}`);
    expect(result).toEqual({
      ok: true,
      data: {
        login: "octocat",
        name: "The Octocat",
        publicRepos: 8,
        htmlUrl: "https://github.com/octocat",
        avatarUrl: null,
        bio: null,
        company: null,
        location: null,
        followers: 0,
        following: 0,
        createdAt: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(String(init?.body ?? "")).not.toContain(token);
  });

  it("treats a missing GitHub user as an invalid account", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () => jsonResponse({ message: "Not Found" }, 404));
    const github = serviceWith(fetchImpl);

    const result = await github.getProfile("missing-user");

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_account",
    });
  });

  it("reports a rate limit without calling GitHub again until the reset time", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse({ message: "API rate limit exceeded" }, 403, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "200",
      }),
    );
    let now = 100_000;
    const github = serviceWith(fetchImpl, { now: () => now });

    const first = await github.listRepositories("octocat");
    const second = await github.listRepositories("octocat");
    now = 200_000;
    await github.listRepositories("octocat");

    expect(first).toMatchObject({ ok: false, code: "rate_limited" });
    if (!first.ok) {
      expect(first.message).toMatch(/minute/i);
    }
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns an empty repository list when GitHub has none", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () => jsonResponse([]));
    const github = serviceWith(fetchImpl);

    await expect(github.listRepositories("octocat")).resolves.toEqual({ ok: true, data: [] });
  });

  it("maps pull requests and an open count", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async (input) => {
      const url = String(input);
      if (url.includes("state%3Aopen") || url.includes("state:open")) {
        return jsonResponse({ total_count: 1, incomplete_results: false, items: [] });
      }
      return jsonResponse({
        total_count: 2,
        incomplete_results: false,
        items: [
          {
            number: 7,
            title: "Add contributing guide",
            html_url: "https://github.com/octocat/hello/pull/7",
            state: "closed",
            updated_at: "2026-01-02T00:00:00Z",
            repository_url: "https://api.github.com/repos/octocat/hello",
            pull_request: { merged_at: "2026-01-02T00:00:00Z" },
          },
        ],
      });
    });
    const github = serviceWith(fetchImpl);

    const result = await github.listPullRequests("octocat");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCount).toBe(2);
      expect(result.data.openCount).toBe(1);
      expect(result.data.pullRequests[0]).toMatchObject({
        number: 7,
        repository: "octocat/hello",
        merged: true,
        htmlUrl: "https://github.com/octocat/hello/pull/7",
      });
    }
  });

  it("does not call GitHub for contribution history when no token is configured", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    const github = serviceWith(fetchImpl, { token: null });

    const result = await github.getContributionCalendar("octocat");

    expect(result).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps contribution days from the GraphQL calendar", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: 3,
                weeks: [
                  {
                    contributionDays: [
                      { date: "2026-01-01", contributionCount: 2 },
                      { date: "2026-01-02", contributionCount: 1 },
                    ],
                  },
                ],
              },
            },
          },
        },
      }),
    );
    const github = serviceWith(fetchImpl, { token });

    const result = await github.getContributionCalendar("octocat");
    const init = fetchImpl.mock.calls[0]?.[1];

    expect(String(init?.body)).not.toContain(token);
    expect(result).toEqual({
      ok: true,
      data: {
        total: 3,
        days: [
          { date: "2026-01-01", count: 2 },
          { date: "2026-01-02", count: 1 },
        ],
      },
    });
  });

  it("maps public events and treats an empty list as success", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse([
        {
          id: "1",
          type: "PushEvent",
          created_at: "2026-02-01T00:00:00Z",
          repo: { name: "octocat/hello" },
          payload: { size: 2, commits: [{}, {}] },
        },
      ]),
    );
    const github = serviceWith(fetchImpl);

    await expect(github.listPublicEvents("octocat")).resolves.toEqual({
      ok: true,
      data: [
        {
          id: "1",
          summary: "Pushed 2 commits",
          repoName: "octocat/hello",
          createdAt: "2026-02-01T00:00:00Z",
        },
      ],
    });

    github.clearCache();
    fetchImpl.mockResolvedValueOnce(jsonResponse([]));
    await expect(github.listPublicEvents("octocat")).resolves.toEqual({ ok: true, data: [] });
  });

  it("turns network and server failures into an unavailable result", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    fetchImpl.mockRejectedValueOnce(new TypeError("network down"));
    const github = serviceWith(fetchImpl);

    const offline = await github.getProfile("octocat");
    expect(offline).toMatchObject({ ok: false, code: "unavailable" });

    fetchImpl.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 500));
    const failed = await github.getProfile("octocat");
    expect(failed).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(failed)).not.toContain(token);
  });

  it("reports refused server credentials", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse({ message: `bad credentials ${token}` }, 401),
    );
    const github = serviceWith(fetchImpl, { token });

    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((line) => {
      errors.push(String(line));
    });
    const result = await github.getProfile("octocat");
    spy.mockRestore();

    expect(result).toMatchObject({ ok: false, code: "unauthorized" });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(errors.join("\n")).not.toContain(token);
  });

  it("refuses every GitHub call when the server token is missing", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    const github = serviceWith(fetchImpl, { token: null });

    await expect(github.getAuthenticatedUser()).resolves.toMatchObject({
      ok: false,
      code: "not_configured",
    });
    await expect(github.getRepositories()).resolves.toMatchObject({ code: "not_configured" });
    await expect(github.getRepository("octocat", "hello")).resolves.toMatchObject({
      code: "not_configured",
    });
    await expect(github.validatePullRequestUrl("https://github.com/octocat/hello/pull/1")).resolves.toMatchObject({
      code: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("loads the authenticated user, a repository, and its pull requests", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>(async (input) => {
      const url = String(input);
      if (url.endsWith("/user")) {
        return jsonResponse({
          id: 1,
          login: "app-bot",
          name: "App Bot",
          html_url: "https://github.com/app-bot",
          public_repos: 2,
        });
      }
      if (url.endsWith("/repos/octocat/hello")) {
        return jsonResponse({
          id: 10,
          name: "hello",
          full_name: "octocat/hello",
          description: "Demo",
          html_url: "https://github.com/octocat/hello",
          language: "TypeScript",
          stargazers_count: 4,
          forks_count: 1,
          updated_at: "2026-03-01T00:00:00Z",
          private: false,
          fork: false,
          default_branch: "main",
          open_issues_count: 3,
          pushed_at: "2026-03-02T00:00:00Z",
          owner: { login: "octocat" },
        });
      }
      if (url.includes("/pulls/7")) {
        return jsonResponse({
          number: 7,
          title: "Add a guide",
          body: "Details",
          state: "open",
          draft: false,
          merged_at: null,
          html_url: "https://github.com/octocat/hello/pull/7",
          user: { login: "octocat" },
          head: { ref: "guide" },
          base: { ref: "main" },
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          commits: 2,
          additions: 10,
          deletions: 1,
          changed_files: 3,
        });
      }
      return jsonResponse([
        {
          number: 7,
          title: "Add a guide",
          body: "Details",
          state: "open",
          html_url: "https://github.com/octocat/hello/pull/7",
          user: { login: "octocat" },
          head: { ref: "guide" },
          base: { ref: "main" },
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        },
      ]);
    });
    const github = serviceWith(fetchImpl);

    const user = await github.getAuthenticatedUser();
    const repository = await github.getRepository("octocat", "hello");
    const pulls = await github.getPullRequests("octocat", "hello");
    const pull = await github.getPullRequest("octocat", "hello", 7);
    const validated = await github.validatePullRequestUrl(
      "https://github.com/octocat/hello/pull/7/files?diff=split",
    );

    expect(user).toMatchObject({ ok: true, data: { login: "app-bot", publicRepos: 2 } });
    expect(repository).toMatchObject({
      ok: true,
      data: { fullName: "octocat/hello", defaultBranch: "main", openIssues: 3 },
    });
    expect(pulls.ok && pulls.data[0]?.commits).toBe(null);
    expect(pull).toMatchObject({
      ok: true,
      data: { number: 7, commits: 2, additions: 10, changedFiles: 3, authorLogin: "octocat" },
    });
    expect(validated).toMatchObject({
      ok: true,
      data: { owner: "octocat", repo: "hello", number: 7, url: "https://github.com/octocat/hello/pull/7" },
    });
    expect(JSON.stringify({ user, repository, pulls, pull, validated })).not.toContain(token);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://api.github.com/user");
  });

  it("rejects a pull request URL that is not on GitHub before calling the API", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    const github = serviceWith(fetchImpl);

    const result = await github.validatePullRequestUrl("https://example.com/octocat/hello/pull/7");

    expect(result).toMatchObject({ ok: false, code: "invalid_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing pull request and a request timeout", async () => {
    const fetchImpl = vi.fn<GitHubFetcher>();
    fetchImpl.mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404));
    const github = serviceWith(fetchImpl);

    const missing = await github.getPullRequest("octocat", "hello", 99);
    expect(missing).toMatchObject({
      ok: false,
      code: "not_found",
      message: "GitHub could not find that pull request.",
    });

    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchImpl.mockRejectedValueOnce(timeout);
    const timedOut = await github.getRepository("octocat", "hello");
    expect(timedOut).toMatchObject({
      ok: false,
      code: "unavailable",
      message: "GitHub took too long to respond.",
    });
  });

  it("reads GITHUB_TOKEN and ignores NEXT_PUBLIC_GITHUB_TOKEN", async () => {
    const previous = process.env.GITHUB_TOKEN;
    const previousPublic = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = token;
    process.env.NEXT_PUBLIC_GITHUB_TOKEN = "public-token-must-not-be-used";

    const fetchImpl = vi.fn<GitHubFetcher>(async () =>
      jsonResponse({
        id: 1,
        login: "app-bot",
        name: null,
        html_url: "https://github.com/app-bot",
        public_repos: 0,
      }),
    );
    const github = createGitHubService({ fetchImpl });
    const result = await github.getAuthenticatedUser();
    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);

    expect(headers.get("authorization")).toBe(`Bearer ${token}`);
    expect(headers.get("authorization")).not.toContain("public-token-must-not-be-used");
    expect(JSON.stringify(result)).not.toContain(token);

    if (previous === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = previous;
    }
    if (previousPublic === undefined) {
      delete process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_GITHUB_TOKEN = previousPublic;
    }
  });
});
