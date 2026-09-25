import type { GitHubFetcher } from "@/lib/github/client";

const API_ROOT = "https://api.github.com";
const PULL_PATH = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Deterministic GitHub stand-in for end-to-end tests.
 * Enabled only when E2E_GITHUB_FIXTURE=1 and the process is not production.
 * The token is a fixture marker, not a GitHub credential.
 */
export function e2eGitHubOptions(): { fetchImpl: GitHubFetcher; token: string } | undefined {
  if (process.env.E2E_GITHUB_FIXTURE !== "1" || process.env.NODE_ENV === "production") {
    return undefined;
  }

  const fetchImpl: GitHubFetcher = async (input) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = href.startsWith(API_ROOT) ? href.slice(API_ROOT.length).split("?")[0] ?? "" : "";
    const match = PULL_PATH.exec(path);
    const owner = decodeURIComponent(match?.[1] ?? "");
    const repo = decodeURIComponent(match?.[2] ?? "");
    const number = Number(match?.[3]);
    const userMatch = /^\/users\/([^/]+)$/.exec(path);

    if (userMatch) {
      const login = decodeURIComponent(userMatch[1] ?? "");
      return json(
        {
          login,
          name: login,
          public_repos: 1,
          html_url: `https://github.com/${login}`,
          avatar_url: "https://avatars.githubusercontent.com/u/1",
          bio: null,
          company: null,
          location: null,
          followers: 0,
          following: 0,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        200,
      );
    }

    if (path === "/search/issues") {
      return json({ total_count: 0, incomplete_results: false, items: [] }, 200);
    }

    if (path === "/graphql") {
      return json(
        {
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: { totalContributions: 0, weeks: [] },
              },
            },
          },
        },
        200,
      );
    }

    if (!match) {
      return json({ message: "Not Found" }, 404);
    }

    return json(
      {
        number,
        title: `Fixture pull request ${number}`,
        body: "Deterministic fixture.",
        state: "open",
        draft: false,
        merged_at: null,
        html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
        user: { login: owner },
        head: { ref: "fixture" },
        base: { ref: "main" },
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        commits: 1,
        additions: 1,
        deletions: 0,
        changed_files: 1,
      },
      200,
    );
  };

  return { fetchImpl, token: "e2e-fixture" };
}
