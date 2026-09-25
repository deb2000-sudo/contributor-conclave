import { GitHubGate } from "@/components/student/github-gate";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { github, missingGitHubAccount, type GitHubResult, type GitHubProfile } from "@/lib/github";
import { formatTimestamp } from "@/lib/student/labels";

export async function RepositoryPanel({ username }: { username: string | null }) {
  if (!username) {
    return <GitHubGate result={missingGitHubAccount()}>{() => null}</GitHubGate>;
  }

  const [profile, repositories] = await Promise.all([
    github.getProfile(username),
    github.listRepositories(username),
  ]);

  return (
    <GitHubGate
      result={repositories}
      isEmpty={(items) => items.length === 0}
      emptyTitle="No repositories returned"
      emptyDescription={emptyRepositoryDescription(profile)}
    >
      {(items) => (
        <div className="flex flex-col gap-4">
          {profile.ok && items.length < profile.data.publicRepos ? (
            <p className="text-sm text-ink/75 dark:text-paper/75">
              Showing the {items.length} most recently updated of {profile.data.publicRepos} public
              repositories.
            </p>
          ) : null}
          <DataTable
            caption="GitHub repositories"
            emptyTitle="No repositories returned"
            emptyDescription="GitHub returned no public repositories for this account."
            columns={[
              { key: "repository", header: "Repository" },
              { key: "description", header: "Description" },
              { key: "language", header: "Language" },
              { key: "stars", header: "Stars" },
              { key: "updated", header: "Updated" },
            ]}
            rows={items.map((repository) => ({
              id: String(repository.id),
              repository: (
                <span className="flex flex-col gap-1">
                  <TextLink href={repository.htmlUrl ?? ""}>{repository.fullName}</TextLink>
                  {repository.isPrivate ? <StatusBadge tone="neutral">Private</StatusBadge> : null}
                  {repository.isFork ? <StatusBadge tone="neutral">Fork</StatusBadge> : null}
                </span>
              ),
              description: repository.description ?? "No description",
              language: repository.language ?? "—",
              stars: String(repository.stars),
              updated: repository.updatedAt ? (
                <time dateTime={repository.updatedAt}>{formatTimestamp(repository.updatedAt)}</time>
              ) : (
                "—"
              ),
            }))}
          />
        </div>
      )}
    </GitHubGate>
  );
}

function emptyRepositoryDescription(profile: GitHubResult<GitHubProfile>): string {
  if (profile.ok && profile.data.publicRepos > 0) {
    return `GitHub lists ${profile.data.publicRepos} public repositories, and this response included none.`;
  }
  return "GitHub returned no public repositories for this account.";
}
