import { z } from "zod";

import { githubUsernameSchema } from "@/lib/auth/validation";
import { logError } from "@/lib/log";

import {
  githubFailure,
  type GitHubAuthenticatedUser,
  type GitHubContributionCalendar,
  type GitHubProfile,
  type GitHubPublicEvent,
  type GitHubPullRequest,
  type GitHubPullRequestDetails,
  type GitHubPullRequestList,
  type GitHubRepository,
  type GitHubRepositoryDetails,
  type GitHubResult,
  type ParsedPullRequestUrl,
} from "@/lib/github/types";

const profileSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  public_repos: z.number(),
  html_url: z.string(),
  avatar_url: z.string().optional(),
  bio: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  created_at: z.string().optional(),
});

const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  updated_at: z.string().nullable(),
  private: z.boolean(),
  fork: z.boolean(),
  archived: z.boolean().optional(),
});

const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  state: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string(),
  repository_url: z.string(),
  draft: z.boolean().optional(),
  pull_request: z
    .object({
      merged_at: z.string().nullable().optional(),
    })
    .optional(),
});

const searchSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(pullRequestSchema),
});

const calendarSchema = z.object({
  data: z
    .object({
      user: z
        .object({
          contributionsCollection: z.object({
            contributionCalendar: z.object({
              totalContributions: z.number(),
              weeks: z.array(
                z.object({
                  contributionDays: z.array(
                    z.object({
                      contributionCount: z.number(),
                      date: z.string(),
                    }),
                  ),
                }),
              ),
            }),
          }),
        })
        .nullable(),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const eventSchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  created_at: z.string(),
  repo: z.object({ name: z.string() }).nullable(),
  payload: z
    .object({
      action: z.string().optional(),
      size: z.number().optional(),
      ref_type: z.string().optional(),
      commits: z.array(z.unknown()).optional(),
    })
    .nullable()
    .optional(),
});

export function normalizeGitHubUsername(username: string): string | null {
  const parsed = githubUsernameSchema.safeParse(username);
  return parsed.success ? parsed.data : null;
}

export function githubAvatarUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const allowed =
      url.hostname === "avatars.githubusercontent.com" || url.hostname === "github.com";
    if (url.protocol !== "https:" || !allowed) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function githubWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function unreadable(path: string): GitHubResult<never> {
  logError("github_response_invalid", { path });
  return githubFailure("unavailable", "GitHub returned a response this app could not read.");
}

export function parseProfile(body: unknown): GitHubResult<GitHubProfile> {
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/users");
  }

  return {
    ok: true,
    data: {
      login: parsed.data.login,
      name: parsed.data.name,
      publicRepos: parsed.data.public_repos,
      htmlUrl: githubWebUrl(parsed.data.html_url),
      avatarUrl: githubAvatarUrl(parsed.data.avatar_url),
      bio: parsed.data.bio ?? null,
      company: parsed.data.company ?? null,
      location: parsed.data.location ?? null,
      followers: parsed.data.followers ?? 0,
      following: parsed.data.following ?? 0,
      createdAt: parsed.data.created_at ?? null,
    },
  };
}

export function parseRepositories(body: unknown): GitHubResult<GitHubRepository[]> {
  const parsed = z.array(repositorySchema).safeParse(body);
  if (!parsed.success) {
    return unreadable("/users/repos");
  }

  return {
    ok: true,
    data: parsed.data.map(toRepository),
  };
}

function repositoryName(repositoryUrl: string): string {
  try {
    const url = new URL(repositoryUrl);
    const [, , owner, name] = url.pathname.split("/");
    if (url.hostname === "api.github.com" && owner && name) {
      return `${owner}/${name}`;
    }
  } catch {
    return repositoryUrl;
  }
  return repositoryUrl;
}

function toRepository(repository: z.infer<typeof repositorySchema>): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    htmlUrl: githubWebUrl(repository.html_url),
    language: repository.language,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    updatedAt: repository.updated_at ?? "",
    isPrivate: repository.private,
    isFork: repository.fork,
    isArchived: repository.archived ?? false,
  };
}

function toPullRequest(item: z.infer<typeof pullRequestSchema>): GitHubPullRequest {
  const repository = repositoryName(item.repository_url);
  return {
    id: `${repository}#${item.number}`,
    number: item.number,
    title: item.title,
    htmlUrl: githubWebUrl(item.html_url),
    repository,
    state: item.state,
    draft: item.draft ?? false,
    merged: Boolean(item.pull_request?.merged_at),
    createdAt: item.created_at ?? "",
    updatedAt: item.updated_at,
  };
}

export function parsePullRequestSearch(body: unknown): GitHubResult<GitHubPullRequestList> {
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/search/issues");
  }

  return {
    ok: true,
    data: {
      totalCount: parsed.data.total_count,
      openCount: null,
      openCountMessage: null,
      incomplete: parsed.data.incomplete_results,
      pullRequests: parsed.data.items.map(toPullRequest),
    },
  };
}

export function parseContributionCalendar(body: unknown): GitHubResult<GitHubContributionCalendar> {
  const parsed = calendarSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/graphql");
  }

  const rateLimited = parsed.data.errors?.some((error) => /rate limit/i.test(error.message));
  if (rateLimited) {
    return githubFailure(
      "rate_limited",
      "GitHub rate limit was reached. Try again in a few minutes.",
    );
  }

  const user = parsed.data.data?.user;
  if (!user) {
    return githubFailure("invalid_account", "No GitHub account matches this username.");
  }

  const calendar = user.contributionsCollection.contributionCalendar;
  return {
    ok: true,
    data: {
      total: calendar.totalContributions,
      days: calendar.weeks.flatMap((week) =>
        week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
        })),
      ),
    },
  };
}

function eventSummary(event: z.infer<typeof eventSchema>): string {
  const type = event.type ?? "Activity";
  const action = event.payload?.action;
  const commits = event.payload?.commits?.length ?? event.payload?.size;

  switch (type) {
    case "PushEvent":
      if (typeof commits === "number") {
        return `Pushed ${commits} ${commits === 1 ? "commit" : "commits"}`;
      }
      return "Pushed commits";
    case "PullRequestEvent":
      return action ? `${action} a pull request` : "Updated a pull request";
    case "PullRequestReviewEvent":
      return "Reviewed a pull request";
    case "PullRequestReviewCommentEvent":
      return "Commented on a pull request";
    case "IssuesEvent":
      return action ? `${action} an issue` : "Updated an issue";
    case "IssueCommentEvent":
      return "Commented on an issue";
    case "CreateEvent":
      return event.payload?.ref_type ? `Created a ${event.payload.ref_type}` : "Created a reference";
    case "DeleteEvent":
      return event.payload?.ref_type ? `Deleted a ${event.payload.ref_type}` : "Deleted a reference";
    case "WatchEvent":
      return "Starred a repository";
    case "ForkEvent":
      return "Forked a repository";
    case "ReleaseEvent":
      return action ? `${action} a release` : "Updated a release";
    default:
      return type.replace(/Event$/, "").replace(/([A-Z])/g, " $1").trim();
  }
}

const authenticatedUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  html_url: z.string(),
  public_repos: z.number(),
});

const repositoryDetailsSchema = repositorySchema.extend({
  default_branch: z.string(),
  open_issues_count: z.number(),
  pushed_at: z.string().nullable(),
  owner: z.object({ login: z.string() }),
});

const pullRequestDetailsSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  draft: z.boolean().optional(),
  merged_at: z.string().nullable().optional(),
  html_url: z.string(),
  user: z.object({ login: z.string() }).nullable(),
  head: z.object({ ref: z.string() }),
  base: z.object({ ref: z.string() }),
  created_at: z.string(),
  updated_at: z.string(),
  commits: z.number().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
});

const resourceName = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const pullPageSections = new Set(["files", "commits", "checks", "changes"]);

export function parsePullRequestUrl(value: string): ParsedPullRequestUrl | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 && parts.length !== 5) {
    return null;
  }

  const [owner, repo, section, pull, extra] = parts;
  if (!owner || !repo || !pull || section !== "pull") {
    return null;
  }

  if (extra && !pullPageSections.has(extra)) {
    return null;
  }

  if (!resourceName.test(owner) || !resourceName.test(repo) || !/^[1-9]\d*$/.test(pull)) {
    return null;
  }

  const number = Number(pull);
  if (!Number.isSafeInteger(number)) {
    return null;
  }

  return { owner, repo, number };
}

export function canonicalPullRequestUrl(value: ParsedPullRequestUrl): string {
  return `https://github.com/${value.owner.toLowerCase()}/${value.repo.toLowerCase()}/pull/${value.number}`;
}

export function repositoryCoordinates(owner: string, repo: string): { owner: string; repo: string } | null {
  if (!resourceName.test(owner) || !resourceName.test(repo)) {
    return null;
  }

  return { owner, repo };
}

function toPullRequestDetails(item: z.infer<typeof pullRequestDetailsSchema>): GitHubPullRequestDetails {
  return {
    number: item.number,
    title: item.title,
    body: item.body,
    state: item.state,
    draft: item.draft ?? false,
    merged: Boolean(item.merged_at),
    htmlUrl: githubWebUrl(item.html_url),
    authorLogin: item.user?.login ?? null,
    headRef: item.head.ref,
    baseRef: item.base.ref,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    commits: item.commits ?? null,
    additions: item.additions ?? null,
    deletions: item.deletions ?? null,
    changedFiles: item.changed_files ?? null,
  };
}

export function parseAuthenticatedUser(body: unknown): GitHubResult<GitHubAuthenticatedUser> {
  const parsed = authenticatedUserSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/user");
  }

  return {
    ok: true,
    data: {
      id: parsed.data.id,
      login: parsed.data.login,
      name: parsed.data.name,
      publicRepos: parsed.data.public_repos,
      htmlUrl: githubWebUrl(parsed.data.html_url),
    },
  };
}

export function parseRepositoryDetails(body: unknown): GitHubResult<GitHubRepositoryDetails> {
  const parsed = repositoryDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/repos");
  }

  const repository = parsed.data;
  return {
    ok: true,
    data: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description,
      htmlUrl: githubWebUrl(repository.html_url),
      language: repository.language,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      updatedAt: repository.updated_at ?? "",
      isPrivate: repository.private,
      isFork: repository.fork,
      isArchived: repository.archived ?? false,
      owner: repository.owner.login,
      defaultBranch: repository.default_branch,
      openIssues: repository.open_issues_count,
      pushedAt: repository.pushed_at ?? "",
    },
  };
}

export function parsePullRequestDetails(body: unknown): GitHubResult<GitHubPullRequestDetails> {
  const parsed = pullRequestDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return unreadable("/repos/pulls");
  }

  return { ok: true, data: toPullRequestDetails(parsed.data) };
}

export function parsePullRequestDetailsList(body: unknown): GitHubResult<GitHubPullRequestDetails[]> {
  const parsed = z.array(pullRequestDetailsSchema).safeParse(body);
  if (!parsed.success) {
    return unreadable("/repos/pulls");
  }

  return { ok: true, data: parsed.data.map(toPullRequestDetails) };
}

export function parsePublicEvents(body: unknown): GitHubResult<GitHubPublicEvent[]> {
  const parsed = z.array(eventSchema).safeParse(body);
  if (!parsed.success) {
    return unreadable("/users/events/public");
  }

  return {
    ok: true,
    data: parsed.data.map((event) => ({
      id: event.id,
      summary: eventSummary(event),
      repoName: event.repo?.name ?? "Unknown repository",
      createdAt: event.created_at,
    })),
  };
}
