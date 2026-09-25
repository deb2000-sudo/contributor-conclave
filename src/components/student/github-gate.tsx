import type { ReactNode } from "react";

import { RetryRefresh } from "@/components/student/retry-refresh";
import { EmptyState } from "@/components/ui/empty-state";
import type { GitHubFailureCode, GitHubResult } from "@/lib/github";

const titles: Record<GitHubFailureCode, string> = {
  missing_account: "No GitHub username",
  not_configured: "GitHub token required",
  rate_limited: "GitHub rate limit",
  invalid_account: "GitHub account not found",
  invalid_url: "Pull request URL is not valid",
  not_found: "GitHub resource not found",
  unauthorized: "GitHub credentials refused",
  unavailable: "GitHub unavailable",
};

export function GitHubGate<T>({
  result,
  isEmpty,
  emptyTitle = "Nothing from GitHub",
  emptyDescription = "GitHub returned no records for this account.",
  children,
}: {
  result: GitHubResult<T>;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: (data: T) => ReactNode;
}) {
  if (!result.ok) {
    return <RetryRefresh title={titles[result.code]} message={result.message} />;
  }

  if (isEmpty?.(result.data)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return children(result.data);
}
