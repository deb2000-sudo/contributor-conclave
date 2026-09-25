import { logError } from "@/lib/log";

import { githubFailure, type GitHubFailureCode, type GitHubResult } from "@/lib/github/types";

const API_ROOT = "https://api.github.com";
const SUCCESS_TTL_MS = 60_000;
const CACHE_LIMIT = 200;

export type GitHubFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type CacheEntry = {
  expiresAt: number;
  value: GitHubResult<unknown>;
};

export type GitHubClient = {
  request: (
    path: string,
    init?: { method?: "GET" | "POST"; body?: string },
  ) => Promise<GitHubResult<unknown>>;
  clearCache: () => void;
};

function readMessage(body: unknown): string {
  if (typeof body === "object" && body && "message" in body && typeof body.message === "string") {
    return body.message;
  }
  return "";
}

function retryMessage(headers: Headers, now: number): string {
  const retryAfter = headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    const minutes = Math.max(1, Math.ceil(Number(retryAfter) / 60));
    return `GitHub rate limit was reached. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }

  const reset = headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) {
    const seconds = Number(reset) - Math.floor(now / 1000);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `GitHub rate limit was reached. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }

  return "GitHub rate limit was reached. Try again in a few minutes.";
}

function classify(
  status: number,
  headers: Headers,
  body: unknown,
  now: number,
): GitHubResult<never> | null {
  const remaining = headers.get("x-ratelimit-remaining");
  const message = readMessage(body);
  const rateLimited =
    status === 429 ||
    ((status === 403 || status === 429) && remaining === "0") ||
    (status === 403 && /rate limit/i.test(message));

  if (rateLimited) {
    return githubFailure("rate_limited", retryMessage(headers, now));
  }

  if (status === 404) {
    return githubFailure("not_found", "GitHub could not find that resource.");
  }

  if (status === 401) {
    return githubFailure("unauthorized", "GitHub refused the server credentials.");
  }

  if (status === 422) {
    return githubFailure("invalid_account", "This GitHub username cannot be looked up.");
  }

  if (status < 200 || status >= 300) {
    return githubFailure("unavailable", "GitHub could not complete this request.");
  }

  return null;
}

function cacheTtl(
  result: GitHubResult<unknown>,
  headers: Headers,
  now: number,
): number | null {
  if (result.ok) {
    return SUCCESS_TTL_MS;
  }

  if (result.code === "invalid_account" || result.code === "not_found") {
    return SUCCESS_TTL_MS;
  }

  if (result.code !== "rate_limited") {
    return null;
  }

  const reset = headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) {
    return Math.max(1000, Number(reset) * 1000 - now);
  }

  const retryAfter = headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }

  return SUCCESS_TTL_MS;
}

function remember(cache: Map<string, CacheEntry>, key: string, entry: CacheEntry, now: number) {
  if (cache.size >= CACHE_LIMIT) {
    for (const [cachedKey, cached] of cache) {
      if (cached.expiresAt <= now) {
        cache.delete(cachedKey);
      }
    }
  }

  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }

  cache.set(key, entry);
}

function redactToken(value: string, token: string | null): string {
  if (!token || !value.includes(token)) {
    return value;
  }

  return value.split(token).join("[redacted]");
}

export function createGitHubClient(options: {
  fetchImpl: GitHubFetcher;
  token: string | null;
  now: () => number;
}): GitHubClient {
  const cache = new Map<string, CacheEntry>();

  return {
    clearCache() {
      cache.clear();
    },
    async request(path, init) {
      const method = init?.method ?? "GET";
      const key = `${options.token ? "token" : "public"}:${method}:${path}:${init?.body ?? ""}`;
      const now = options.now();
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const headers = new Headers({
        Accept: "application/vnd.github+json",
        "User-Agent": "contributor-conclave",
        "X-GitHub-Api-Version": "2022-11-28",
      });

      if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
      }

      if (init?.body) {
        headers.set("Content-Type", "application/json");
      }

      let response: Response;
      try {
        response = await options.fetchImpl(`${API_ROOT}${path}`, {
          method,
          headers,
          body: init?.body,
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        logError("github_request_failed", {
          path: redactToken(path, options.token),
          status: 0,
          code: "unavailable",
        });
        return githubFailure(
          "unavailable",
          timedOut ? "GitHub took too long to respond." : "GitHub could not be reached.",
        );
      }

      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }

      const failure = classify(response.status, response.headers, body, options.now());
      const result: GitHubResult<unknown> = failure ?? { ok: true, data: body };
      const code: GitHubFailureCode | "ok" = result.ok ? "ok" : result.code;

      if (!result.ok) {
        logError("github_request_failed", {
          path: redactToken(path, options.token),
          status: response.status,
          code,
        });
      }

      const ttl = cacheTtl(result, response.headers, options.now());
      if (ttl !== null) {
        remember(cache, key, { expiresAt: options.now() + ttl, value: result }, options.now());
      }

      return result;
    },
  };
}
