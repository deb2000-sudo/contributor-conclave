import { createGitHubClient, type GitHubFetcher } from "@/lib/github/client";
import { readGitHubToken } from "@/lib/github/env";
import { e2eGitHubOptions } from "@/lib/github/fixture";
import {
  canonicalPullRequestUrl,
  normalizeGitHubUsername,
  parseAuthenticatedUser,
  parseContributionCalendar,
  parseProfile,
  parsePublicEvents,
  parsePullRequestDetails,
  parsePullRequestDetailsList,
  parsePullRequestSearch,
  parsePullRequestUrl,
  parseRepositories,
  parseRepositoryDetails,
  repositoryCoordinates,
} from "@/lib/github/parse";
import {
  githubFailure,
  type GitHubAuthenticatedUser,
  type GitHubContributionCalendar,
  type GitHubProfile,
  type GitHubPublicEvent,
  type GitHubPullRequestDetails,
  type GitHubPullRequestList,
  type GitHubRecentPullRequests,
  type GitHubRepository,
  type GitHubRepositoryDetails,
  type GitHubResult,
  type ValidatedPullRequest,
} from "@/lib/github/types";

const CALENDAR_QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

export type GitHubServiceOptions = {
  fetchImpl?: GitHubFetcher;
  token?: string | null;
  now?: () => number;
};

function invalidUsername(): GitHubResult<never> {
  return githubFailure("invalid_account", "This GitHub username cannot be looked up.");
}

const tokenRequired = githubFailure(
  "not_configured",
  "A server GitHub personal access token is required.",
);

export function missingGitHubAccount(): GitHubResult<never> {
  return githubFailure("missing_account", "No GitHub username is saved on this account.");
}

export function createGitHubService(options: GitHubServiceOptions = {}) {
  const token = "token" in options ? (options.token?.trim() ? options.token.trim() : null) : readGitHubToken();
  const now = options.now ?? Date.now;
  const client = createGitHubClient({
    fetchImpl: options.fetchImpl ?? ((input, init) => fetch(input, init)),
    token,
    now,
  });

  function requireToken(): GitHubResult<never> | null {
    return token ? null : tokenRequired;
  }

  function missingUser(result: GitHubResult<unknown>): GitHubResult<never> | null {
    if (!result.ok && result.code === "not_found") {
      return githubFailure("invalid_account", "No GitHub account matches this username.");
    }

    return null;
  }

  async function getAuthenticatedUser(): Promise<GitHubResult<GitHubAuthenticatedUser>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const response = await client.request("/user");
    if (!response.ok) {
      if (response.code === "not_found") {
        return githubFailure("not_found", "GitHub could not find the authenticated user.");
      }
      return response;
    }

    return parseAuthenticatedUser(response.data);
  }

  async function getProfile(username: string): Promise<GitHubResult<GitHubProfile>> {
    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const response = await client.request(`/users/${encodeURIComponent(login)}`);
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }
    return parseProfile(response.data);
  }

  async function getRepositories(owner?: string): Promise<GitHubResult<GitHubRepository[]>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    if (owner === undefined) {
      const response = await client.request("/user/repos?per_page=30&sort=updated&direction=desc");
      if (!response.ok) {
        return response;
      }
      return parseRepositories(response.data);
    }

    const login = normalizeGitHubUsername(owner);
    if (!login) {
      return invalidUsername();
    }

    const response = await client.request(
      `/users/${encodeURIComponent(login)}/repos?per_page=30&sort=updated&direction=desc&type=owner`,
    );
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }
    return parseRepositories(response.data);
  }

  async function getRepository(
    owner: string,
    repo: string,
  ): Promise<GitHubResult<GitHubRepositoryDetails>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const coordinates = repositoryCoordinates(owner, repo);
    if (!coordinates) {
      return githubFailure("not_found", "That repository name cannot be looked up.");
    }

    const response = await client.request(
      `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}`,
    );
    if (!response.ok) {
      if (response.code === "not_found") {
        return githubFailure("not_found", "GitHub could not find that repository.");
      }
      return response;
    }
    return parseRepositoryDetails(response.data);
  }

  function listRepositories(username: string): Promise<GitHubResult<GitHubRepository[]>> {
    return getRepositories(username);
  }

  async function listRepositoryCatalog(username: string): Promise<GitHubResult<GitHubRepository[]>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const collected: GitHubRepository[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await client.request(
        `/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated&direction=desc&type=owner&page=${page}`,
      );
      const userMissing = missingUser(response);
      if (userMissing) {
        return userMissing;
      }
      if (!response.ok) {
        return response;
      }

      const parsed = parseRepositories(response.data);
      if (!parsed.ok) {
        return parsed;
      }

      collected.push(...parsed.data);
      if (parsed.data.length < 100) {
        break;
      }
    }

    return { ok: true, data: collected };
  }

  async function searchIssueCount(query: string): Promise<GitHubResult<number>> {
    const response = await client.request(
      `/search/issues?q=${encodeURIComponent(query)}&per_page=1`,
    );
    if (!response.ok) {
      return response;
    }

    const parsed = parsePullRequestSearch(response.data);
    if (!parsed.ok) {
      return parsed;
    }

    return { ok: true, data: parsed.data.totalCount };
  }

  async function getRecentPullRequests(username: string): Promise<GitHubResult<GitHubRecentPullRequests>> {
    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const sinceDate = new Date(now());
    sinceDate.setUTCMonth(sinceDate.getUTCMonth() - 5);
    const since = sinceDate.toISOString().slice(0, 10);
    const windowQuery = `author:${login} type:pr created:>=${since}`;
    const response = await client.request(
      `/search/issues?q=${encodeURIComponent(windowQuery)}&per_page=5&sort=updated&order=desc`,
    );
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }

    const parsed = parsePullRequestSearch(response.data);
    if (!parsed.ok) {
      return parsed;
    }

    const [merged, open, closed] = await Promise.all([
      searchIssueCount(`${windowQuery} is:merged`),
      searchIssueCount(`${windowQuery} is:open`),
      searchIssueCount(`${windowQuery} is:closed is:unmerged`),
    ]);

    return {
      ok: true,
      data: {
        since,
        total: parsed.data.totalCount,
        merged: merged.ok ? merged.data : null,
        open: open.ok ? open.data : null,
        closed: closed.ok ? closed.data : null,
        incomplete: parsed.data.incomplete,
        pullRequests: parsed.data.pullRequests,
      },
    };
  }

  async function getPullRequests(
    owner: string,
    repo: string,
  ): Promise<GitHubResult<GitHubPullRequestDetails[]>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const coordinates = repositoryCoordinates(owner, repo);
    if (!coordinates) {
      return githubFailure("not_found", "That repository name cannot be looked up.");
    }

    const response = await client.request(
      `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
    );
    if (!response.ok) {
      if (response.code === "not_found") {
        return githubFailure("not_found", "GitHub could not find that repository.");
      }
      return response;
    }
    return parsePullRequestDetailsList(response.data);
  }

  async function getPullRequest(
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubResult<GitHubPullRequestDetails>> {
    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const coordinates = repositoryCoordinates(owner, repo);
    if (!coordinates || !Number.isSafeInteger(number) || number < 1) {
      return githubFailure("not_found", "That pull request cannot be looked up.");
    }

    const response = await client.request(
      `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}/pulls/${number}`,
    );
    if (!response.ok) {
      if (response.code === "not_found") {
        return githubFailure("not_found", "GitHub could not find that pull request.");
      }
      return response;
    }
    return parsePullRequestDetails(response.data);
  }

  async function validatePullRequestUrl(value: string): Promise<GitHubResult<ValidatedPullRequest>> {
    const parsed = parsePullRequestUrl(value);
    if (!parsed) {
      return githubFailure("invalid_url", "Enter a GitHub pull request URL.");
    }

    const pullRequest = await getPullRequest(parsed.owner, parsed.repo, parsed.number);
    if (!pullRequest.ok) {
      return pullRequest;
    }

    return {
      ok: true,
      data: {
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number,
        url: canonicalPullRequestUrl(parsed),
        pullRequest: pullRequest.data,
      },
    };
  }

  async function listPullRequests(username: string): Promise<GitHubResult<GitHubPullRequestList>> {
    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const query = encodeURIComponent(`author:${login} type:pr`);
    const response = await client.request(
      `/search/issues?q=${query}&per_page=20&sort=updated&order=desc`,
    );
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }

    const parsed = parsePullRequestSearch(response.data);
    if (!parsed.ok) {
      return parsed;
    }

    const openQuery = encodeURIComponent(`author:${login} type:pr state:open`);
    const openResponse = await client.request(`/search/issues?q=${openQuery}&per_page=1`);
    if (!openResponse.ok) {
      return {
        ok: true,
        data: { ...parsed.data, openCount: null, openCountMessage: openResponse.message },
      };
    }

    const openParsed = parsePullRequestSearch(openResponse.data);
    return {
      ok: true,
      data: {
        ...parsed.data,
        openCount: openParsed.ok ? openParsed.data.totalCount : null,
        openCountMessage: openParsed.ok ? null : openParsed.message,
      },
    };
  }

  async function getContributionCalendar(
    username: string,
  ): Promise<GitHubResult<GitHubContributionCalendar>> {
    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const response = await client.request("/graphql", {
      method: "POST",
      body: JSON.stringify({ query: CALENDAR_QUERY, variables: { login } }),
    });
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }
    return parseContributionCalendar(response.data);
  }

  async function listPublicEvents(username: string): Promise<GitHubResult<GitHubPublicEvent[]>> {
    const login = normalizeGitHubUsername(username);
    if (!login) {
      return invalidUsername();
    }

    const blocked = requireToken();
    if (blocked) {
      return blocked;
    }

    const response = await client.request(
      `/users/${encodeURIComponent(login)}/events/public?per_page=15`,
    );
    const userMissing = missingUser(response);
    if (userMissing) {
      return userMissing;
    }
    if (!response.ok) {
      return response;
    }
    return parsePublicEvents(response.data);
  }

  return {
    getAuthenticatedUser,
    getRepositories,
    getRepository,
    getPullRequests,
    getPullRequest,
    validatePullRequestUrl,
    getProfile,
    listRepositories,
    listRepositoryCatalog,
    getRecentPullRequests,
    listPullRequests,
    getContributionCalendar,
    listPublicEvents,
    clearCache: client.clearCache,
  };
}

export const github = createGitHubService(e2eGitHubOptions() ?? {});
