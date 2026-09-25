import { describe, expect, it } from "vitest";

import type { GitHubRepository } from "@/lib/github";
import { languageShares, monthlyContributions, repositoryBreakdown } from "@/lib/student/insights";

function repository(overrides: Partial<GitHubRepository>): GitHubRepository {
  return {
    id: 1,
    name: "demo",
    fullName: "octocat/demo",
    description: null,
    htmlUrl: null,
    language: null,
    stars: 0,
    forks: 0,
    updatedAt: "",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    ...overrides,
  };
}

describe("github insight totals", () => {
  it("counts original, forked, and archived repositories separately", () => {
    const totals = repositoryBreakdown([
      repository({ id: 1, stars: 3, forks: 1 }),
      repository({ id: 2, isFork: true, stars: 1, forks: 4 }),
      repository({ id: 3, isArchived: true, stars: 2, forks: 2 }),
    ]);

    expect(totals).toEqual({ original: 2, forked: 1, archived: 1, stars: 6, forks: 7 });
  });

  it("keeps the four largest languages and groups the rest", () => {
    const shares = languageShares([
      repository({ id: 1, language: "Python" }),
      repository({ id: 2, language: "Python" }),
      repository({ id: 3, language: "Go" }),
      repository({ id: 4, language: "Rust" }),
      repository({ id: 5, language: "Ruby" }),
      repository({ id: 6, language: "Java" }),
      repository({ id: 7, language: null }),
    ]);

    expect(shares).toEqual([
      { label: "Python", count: 2 },
      { label: "Go", count: 1 },
      { label: "Java", count: 1 },
      { label: "Ruby", count: 1 },
      { label: "Other", count: 2 },
    ]);
  });

  it("sums contributions by month and picks the highest month", () => {
    const trend = monthlyContributions([
      { date: "2025-12-01", count: 40 },
      { date: "2025-12-02", count: 44 },
      { date: "2026-05-01", count: 13 },
    ]);

    expect(trend.months).toEqual([
      { month: "2025-12", count: 84 },
      { month: "2026-05", count: 13 },
    ]);
    expect(trend.peak).toEqual({ month: "2025-12", count: 84 });
  });
});
