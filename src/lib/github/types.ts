export type GitHubFailureCode =
  | "missing_account"
  | "not_configured"
  | "rate_limited"
  | "invalid_account"
  | "invalid_url"
  | "not_found"
  | "unauthorized"
  | "unavailable";

export type GitHubResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: GitHubFailureCode; message: string };

export type GitHubProfile = {
  login: string;
  name: string | null;
  publicRepos: number;
  htmlUrl: string | null;
  avatarUrl: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  createdAt: string | null;
};

/** The account that owns the server personal access token. */
export type GitHubAuthenticatedUser = {
  id: number;
  login: string;
  name: string | null;
  publicRepos: number;
  htmlUrl: string | null;
};

export type GitHubRepositoryDetails = GitHubRepository & {
  owner: string;
  defaultBranch: string;
  openIssues: number;
  pushedAt: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
};

export type GitHubPullRequest = {
  id: string;
  number: number;
  title: string;
  htmlUrl: string | null;
  repository: string;
  state: string;
  draft: boolean;
  merged: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A pull request returned by the repository pulls API. */
export type GitHubPullRequestDetails = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  merged: boolean;
  htmlUrl: string | null;
  authorLogin: string | null;
  headRef: string;
  baseRef: string;
  createdAt: string;
  updatedAt: string;
  commits: number | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
};

export type ParsedPullRequestUrl = {
  owner: string;
  repo: string;
  number: number;
};

export type ValidatedPullRequest = ParsedPullRequestUrl & {
  url: string;
  pullRequest: GitHubPullRequestDetails;
};

export type GitHubRecentPullRequests = {
  since: string;
  total: number;
  merged: number | null;
  open: number | null;
  closed: number | null;
  incomplete: boolean;
  pullRequests: GitHubPullRequest[];
};

export type GitHubPullRequestList = {
  totalCount: number;
  openCount: number | null;
  openCountMessage: string | null;
  incomplete: boolean;
  pullRequests: GitHubPullRequest[];
};

export type GitHubContributionDay = {
  date: string;
  count: number;
};

export type GitHubContributionCalendar = {
  total: number;
  days: GitHubContributionDay[];
};

export type GitHubPublicEvent = {
  id: string;
  summary: string;
  repoName: string;
  createdAt: string;
};

export function githubFailure(
  code: GitHubFailureCode,
  message: string,
): GitHubResult<never> {
  return { ok: false, code, message };
}
