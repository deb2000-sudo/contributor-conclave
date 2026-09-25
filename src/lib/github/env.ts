import "server-only";

/**
 * Server-only GitHub personal access token.
 * Read GITHUB_TOKEN from the environment. Never read NEXT_PUBLIC_GITHUB_TOKEN:
 * a NEXT_PUBLIC_ value is shipped to the browser.
 */
export function readGitHubToken(): string | null {
  const value = process.env.GITHUB_TOKEN;
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
