import { GitHubGate } from "@/components/student/github-gate";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { github, missingGitHubAccount } from "@/lib/github";
import { formatTimestamp, pullRequestLabel } from "@/lib/student/labels";

export async function PullRequestPanel({ username }: { username: string | null }) {
  if (!username) {
    return <GitHubGate result={missingGitHubAccount()}>{() => null}</GitHubGate>;
  }

  const pulls = await github.listPullRequests(username);

  return (
    <GitHubGate
      result={pulls}
      isEmpty={(data) => data.pullRequests.length === 0 && data.totalCount === 0}
      emptyTitle="No public pull requests"
      emptyDescription="GitHub did not return pull requests authored by this account."
    >
      {(data) => (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/75 dark:text-paper/75">
            {data.totalCount} {data.totalCount === 1 ? "pull request" : "pull requests"}
            {data.openCount === null ? "" : `, ${data.openCount} open`}.
            {data.incomplete
              ? " GitHub marked this search as incomplete, so some pull requests may be missing from the list."
              : ""}
          </p>
          {data.openCountMessage ? (
            <p className="text-sm text-ink/75 dark:text-paper/75">{data.openCountMessage}</p>
          ) : null}
          <DataTable
            caption="GitHub pull requests"
            emptyTitle="No pull requests in this page"
            emptyDescription="GitHub reported pull requests, and this page of results was empty."
            columns={[
              { key: "pullRequest", header: "Pull request" },
              { key: "repository", header: "Repository" },
              { key: "state", header: "State" },
              { key: "updated", header: "Updated" },
            ]}
            rows={data.pullRequests.map((pull) => {
              const state = pullRequestLabel(pull);
              return {
                id: pull.id,
                pullRequest: (
                  <TextLink href={pull.htmlUrl ?? ""}>
                    {`#${pull.number} ${pull.title}`}
                  </TextLink>
                ),
                repository: pull.repository,
                state: <StatusBadge tone={state.tone}>{state.label}</StatusBadge>,
                updated: (
                  <time dateTime={pull.updatedAt}>{formatTimestamp(pull.updatedAt)}</time>
                ),
              };
            })}
          />
        </div>
      )}
    </GitHubGate>
  );
}
