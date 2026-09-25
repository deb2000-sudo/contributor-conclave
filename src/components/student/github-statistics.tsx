import { GitHubGate } from "@/components/student/github-gate";
import { StatList } from "@/components/student/fact-list";
import { TextLink } from "@/components/student/text-link";
import { github, missingGitHubAccount } from "@/lib/github";

export async function GitHubStatistics({ username }: { username: string | null }) {
  if (!username) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">GitHub</h2>
        <GitHubGate result={missingGitHubAccount()}>{() => null}</GitHubGate>
      </section>
    );
  }

  const profile = await github.getProfile(username);
  if (!profile.ok) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">GitHub</h2>
        <GitHubGate result={profile}>{() => null}</GitHubGate>
      </section>
    );
  }

  const [pulls, calendar] = await Promise.all([
    github.listPullRequests(username),
    github.getContributionCalendar(username),
  ]);

  const stats = [{ label: "Public repositories", value: String(profile.data.publicRepos) }];
  if (pulls.ok) {
    stats.push({ label: "Pull requests", value: String(pulls.data.totalCount) });
    if (pulls.data.openCount !== null) {
      stats.push({ label: "Open pull requests", value: String(pulls.data.openCount) });
    }
  }
  if (calendar.ok) {
    stats.push({
      label: "Contributions this year",
      value: String(calendar.data.total),
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">GitHub</h2>
      <p className="text-ink/80 dark:text-paper/80">
        <TextLink href={profile.data.htmlUrl ?? ""}>{profile.data.login}</TextLink>
        {profile.data.name ? ` · ${profile.data.name}` : null}
      </p>
      <StatList items={stats} />
      {pulls.ok && pulls.data.openCountMessage ? (
        <p className="text-sm text-ink/75 dark:text-paper/75">{pulls.data.openCountMessage}</p>
      ) : null}
      {pulls.ok ? null : <GitHubGate result={pulls}>{() => null}</GitHubGate>}
      {calendar.ok ? null : <GitHubGate result={calendar}>{() => null}</GitHubGate>}
    </section>
  );
}
