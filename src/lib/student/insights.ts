import type { GitHubContributionDay, GitHubRepository } from "@/lib/github";

export type CountShare = {
  label: string;
  count: number;
};

export type RepositoryBreakdown = {
  original: number;
  forked: number;
  archived: number;
  stars: number;
  forks: number;
};

export type MonthTotal = {
  month: string;
  count: number;
};

export function repositoryBreakdown(repositories: GitHubRepository[]): RepositoryBreakdown {
  return {
    original: repositories.filter((repository) => !repository.isFork).length,
    forked: repositories.filter((repository) => repository.isFork).length,
    archived: repositories.filter((repository) => repository.isArchived).length,
    stars: repositories.reduce((total, repository) => total + repository.stars, 0),
    forks: repositories.reduce((total, repository) => total + repository.forks, 0),
  };
}

export function languageShares(repositories: GitHubRepository[], limit = 4): CountShare[] {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const label = repository.language ?? "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const top = sorted.slice(0, limit).map(([label, count]) => ({ label, count }));
  const rest = sorted.slice(limit).reduce((total, [, count]) => total + count, 0);
  if (rest > 0) {
    top.push({ label: "Other", count: rest });
  }
  return top;
}

export function monthlyContributions(days: GitHubContributionDay[]): {
  months: MonthTotal[];
  peak: MonthTotal | null;
} {
  const totals = new Map<string, number>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      continue;
    }
    totals.set(month, (totals.get(month) ?? 0) + day.count);
  }

  const months = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({ month, count }));
  const peak = months.reduce<MonthTotal | null>((best, month) => {
    if (month.count <= 0) {
      return best;
    }
    if (!best || month.count > best.count) {
      return month;
    }
    return best;
  }, null);

  return { months, peak };
}

export function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return month;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function shortMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return month;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
