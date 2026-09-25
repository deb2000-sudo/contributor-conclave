import Image from "next/image";

import { ContributionCalendar } from "@/components/student/contribution-calendar";
import { GitHubGate } from "@/components/student/github-gate";
import { ContributionTrend, ShareDonut } from "@/components/student/insight-charts";
import { RefreshInsights } from "@/components/student/refresh-insights";
import { TextLink } from "@/components/student/text-link";
import { focusRing } from "@/components/ui/styles";
import { github, missingGitHubAccount } from "@/lib/github";
import {
  languageShares,
  monthLabel,
  monthlyContributions,
  repositoryBreakdown,
} from "@/lib/student/insights";
import { formatDay, formatTimestamp } from "@/lib/student/labels";

const card = "rounded-2xl border border-ink/10 bg-white/50 p-4 sm:p-5 dark:border-paper/15 dark:bg-paper/[0.04]";

function repoWebUrl(name: string): string | null {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) {
    return null;
  }
  return `https://github.com/${name}`;
}

export async function GitHubInsights({ username }: { username: string | null }) {
  const updatedAt = formatTimestamp(new Date());

  if (!username) {
    return (
      <div className="flex flex-col gap-4">
        <InsightsHeader login={null} updatedAt={updatedAt} />
        <GitHubGate result={missingGitHubAccount()}>{() => null}</GitHubGate>
      </div>
    );
  }

  const [profile, repositories, calendar, events, recentPulls] = await Promise.all([
    github.getProfile(username),
    github.listRepositoryCatalog(username),
    github.getContributionCalendar(username),
    github.listPublicEvents(username),
    github.getRecentPullRequests(username),
  ]);

  const login = profile.ok ? profile.data.login : username;
  const breakdown = repositories.ok ? repositoryBreakdown(repositories.data) : null;
  const languages = repositories.ok ? languageShares(repositories.data) : [];
  const trend = calendar.ok ? monthlyContributions(calendar.data.days) : null;
  const catalogNote =
    profile.ok && repositories.ok && repositories.data.length < profile.data.publicRepos
      ? repositories.data.length
      : null;

  return (
    <div className="flex flex-col gap-4">
      <InsightsHeader login={login} updatedAt={updatedAt} />

      <div className="grid gap-4 lg:grid-cols-5">
        <section className={`${card} lg:col-span-1 lg:row-span-2`}>
          <h2 className="sr-only">GitHub profile</h2>
          {profile.ok ? (
            <ProfileCard profile={profile.data} />
          ) : (
            <GitHubGate result={profile}>{() => null}</GitHubGate>
          )}
        </section>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
          <Stat label="Repositories" value={profile.ok ? String(profile.data.publicRepos) : "—"} />
          <Stat label="Original" value={breakdown ? String(breakdown.original) : "—"} />
          <Stat label="Forked" value={breakdown ? String(breakdown.forked) : "—"} />
          <Stat
            label="PRs (5 months)"
            value={recentPulls.ok ? String(recentPulls.data.total) : "—"}
          />
          <Stat
            label="Total contributions"
            value={calendar.ok ? String(calendar.data.total) : "—"}
          />
          <Stat label="Stars" value={breakdown ? String(breakdown.stars) : "—"} />
          <Stat label="Followers" value={profile.ok ? String(profile.data.followers) : "—"} />
          <Stat label="Following" value={profile.ok ? String(profile.data.following) : "—"} />
        </div>
      </div>
      {catalogNote !== null ? (
        <p className="text-sm text-ink/70 dark:text-paper/70">
          Original, forked, archived, stars, and forks are counted from the {catalogNote} repositories
          returned. The repository total is GitHub&apos;s public repository count.
        </p>
      ) : null}
      {!repositories.ok ? <GitHubGate result={repositories}>{() => null}</GitHubGate> : null}
      {!recentPulls.ok ? <GitHubGate result={recentPulls}>{() => null}</GitHubGate> : null}
      {!calendar.ok ? <GitHubGate result={calendar}>{() => null}</GitHubGate> : null}

      <section className={card}>
        <h2 className="text-lg font-semibold">Contribution calendar</h2>
        <div className="mt-4">
          {calendar.ok && calendar.data.days.length > 0 ? (
            <ContributionCalendar calendar={calendar.data} />
          ) : calendar.ok ? (
            <p className="text-ink/75 dark:text-paper/75">
              GitHub returned no contribution days for this account.
            </p>
          ) : (
            <p className="text-sm text-ink/70 dark:text-paper/70">
              The calendar appears when contribution history loads.
            </p>
          )}
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Contribution trend</h2>
          <p className="rounded-full border border-ink/15 px-3 py-1 text-sm dark:border-paper/20">
            1 year
          </p>
        </div>
        <div className="mt-4">
          {trend && trend.months.length > 0 ? (
            <ContributionTrend months={trend.months} />
          ) : (
            <p className="text-ink/75 dark:text-paper/75">
              Monthly totals appear with the contribution calendar.
            </p>
          )}
        </div>
        {trend?.peak ? (
          <p className="mt-2 text-center text-sm text-ink/75 dark:text-paper/75">
            Most active month: {monthLabel(trend.peak.month)} ({trend.peak.count}{" "}
            {trend.peak.count === 1 ? "contribution" : "contributions"})
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={card}>
          <h2 className="text-lg font-semibold">Repositories overview</h2>
          <div className="mt-4">
            {breakdown && profile.ok ? (
              <div className="flex flex-col gap-4">
                <ShareDonut
                  title="Repositories"
                  slices={[
                    { label: "Original", count: breakdown.original },
                    { label: "Forked", count: breakdown.forked },
                  ]}
                />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <Count label="Total" value={profile.data.publicRepos} />
                  <Count label="Original" value={breakdown.original} />
                  <Count label="Forked" value={breakdown.forked} />
                  <Count label="Archived" value={breakdown.archived} />
                  <Count label="Stars" value={breakdown.stars} />
                  <Count label="Forks" value={breakdown.forks} />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-ink/70 dark:text-paper/70">Repository totals are unavailable.</p>
            )}
          </div>
        </section>
        <section className={card}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Languages</h2>
            {languages[0] ? (
              <p className="text-sm text-ink/70 dark:text-paper/70">Most used: {languages[0].label}</p>
            ) : null}
          </div>
          <div className="mt-4">
            <ShareDonut title="Languages" slices={languages} />
          </div>
        </section>
        <section className={card}>
          <h2 className="text-lg font-semibold">Pull requests · last 5 months</h2>
          <div className="mt-4">
            {recentPulls.ok &&
            recentPulls.data.merged !== null &&
            recentPulls.data.open !== null &&
            recentPulls.data.closed !== null ? (
              <ShareDonut
                title="Pull requests in the last 5 months"
                slices={[
                  { label: "Merged", count: recentPulls.data.merged },
                  { label: "Open", count: recentPulls.data.open },
                  { label: "Closed", count: recentPulls.data.closed },
                ]}
              />
            ) : (
              <p className="text-sm text-ink/70 dark:text-paper/70">
                Pull request totals for the last 5 months are unavailable.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-semibold">Recent pull requests · last 5 months</h2>
          <div className="mt-4">
            {recentPulls.ok ? (
              recentPulls.data.pullRequests.length === 0 ? (
                <p className="text-ink/75 dark:text-paper/75">
                  GitHub returned no pull requests in this window.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {recentPulls.data.pullRequests.map((pull) => (
                    <li
                      key={pull.id}
                      className="flex items-start justify-between gap-3 border-t border-ink/10 py-3 first:border-t-0 first:pt-0 dark:border-paper/10"
                    >
                      <div className="min-w-0">
                        <TextLink href={pull.htmlUrl ?? ""}>{pull.title}</TextLink>
                        <p className="text-sm text-moss-700 dark:text-moss-300">{pull.repository}</p>
                      </div>
                      <time
                        dateTime={pull.updatedAt}
                        className="shrink-0 text-sm text-ink/70 dark:text-paper/70"
                      >
                        {formatDay(pull.updatedAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-ink/70 dark:text-paper/70">Recent pull requests are unavailable.</p>
            )}
          </div>
        </section>
        <section className={card}>
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <div className="mt-4">
            {events.ok ? (
              events.data.length === 0 ? (
                <p className="text-ink/75 dark:text-paper/75">
                  GitHub returned no public events for this account.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {events.data.map((event) => {
                    const href = repoWebUrl(event.repoName);
                    return (
                      <li
                        key={event.id}
                        className="flex items-start justify-between gap-3 border-t border-ink/10 py-3 first:border-t-0 first:pt-0 dark:border-paper/10"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{event.summary}</p>
                          <p className="text-sm text-ink/70 dark:text-paper/70">{event.repoName}</p>
                          <p className="text-sm text-ink/70 dark:text-paper/70">
                            <time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time>
                          </p>
                        </div>
                        {href ? (
                          <a
                            href={href}
                            className={`rounded-sm text-sm text-moss-700 underline underline-offset-4 dark:text-moss-300 ${focusRing}`}
                            aria-label={`Open ${event.repoName} on GitHub`}
                          >
                            Open
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <GitHubGate result={events}>{() => null}</GitHubGate>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function InsightsHeader({ login, updatedAt }: { login: string | null; updatedAt: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink/75 dark:text-paper/75">
        {login ? `GitHub insights for @${login}` : "GitHub insights"}
      </p>
      <div className="flex items-center gap-3">
        <p className="text-sm text-ink/70 dark:text-paper/70">Updated {updatedAt}</p>
        <RefreshInsights />
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
}: {
  profile: {
    login: string;
    name: string | null;
    htmlUrl: string | null;
    avatarUrl: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    followers: number;
    following: number;
    createdAt: string | null;
  };
}) {
  const created = profile.createdAt ? new Date(profile.createdAt) : null;
  const joined =
    created && !Number.isNaN(created.getTime())
      ? new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Asia/Kolkata" }).format(
          created,
        )
      : null;

  return (
    <div className="flex flex-col items-center text-center">
      {profile.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt=""
          width={80}
          height={80}
          sizes="80px"
          className="size-20 rounded-full"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full bg-moss-900 text-lg font-semibold text-moss-100"
        >
          {profile.login.slice(0, 1).toUpperCase()}
        </span>
      )}
      <p className="mt-3 text-lg font-semibold">{profile.name ?? profile.login}</p>
      {profile.htmlUrl ? (
        <a
          href={profile.htmlUrl}
          className={`mt-1 rounded-sm text-sm text-moss-700 underline underline-offset-4 dark:text-moss-300 ${focusRing}`}
        >
          View on GitHub
        </a>
      ) : null}
      {profile.bio ? <p className="mt-3 text-sm text-ink/75 dark:text-paper/75">{profile.bio}</p> : null}
      <p className="mt-3 text-sm">
        {profile.followers} followers · {profile.following} following
      </p>
      <ul className="mt-3 space-y-1 text-sm text-ink/75 dark:text-paper/75">
        {profile.location ? <li>{profile.location}</li> : null}
        {profile.company ? <li>{profile.company}</li> : null}
        {joined ? <li>Joined {joined}</li> : null}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-ink/70 dark:text-paper/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 border-t border-ink/10 py-1 dark:border-paper/10">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
