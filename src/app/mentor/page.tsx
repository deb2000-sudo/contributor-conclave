import Link from "next/link";

import { MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { focusRing } from "@/components/ui/styles";
import { requireMentor } from "@/lib/auth/authorization";
import { overview } from "@/lib/mentor/directory";
import { formatTimestamp, reviewLabel, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Overview" };

export default async function MentorPage() {
  const mentor = await requireMentor();
  const result = await overview(mentor.id);

  if (!result.ok) {
    return (
      <MentorSection title="Overview" description="Students and pull requests assigned to you.">
        <ErrorState title="Overview unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const cards = [
    { href: "/mentor/students", label: "Assigned students", value: result.data.assignedStudents },
    { href: "/mentor/pull-requests", label: "Assigned pull requests", value: result.data.assignedPullRequests },
    { href: "/mentor/reviews", label: "Pending reviews", value: result.data.pendingReviews },
    { href: "/mentor/history", label: "Reviews written", value: result.data.reviewsWritten },
  ];

  return (
    <MentorSection title={`Hello, ${mentor.firstName}`} description="Review the pull requests assigned to you.">
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className={`block rounded-2xl border border-ink/10 px-4 py-4 dark:border-paper/10 ${focusRing}`}
            >
              <p className="text-sm text-ink/70 dark:text-paper/70">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-3" aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-lg font-semibold">
          Pending reviews
        </h2>
        {result.data.recent.length === 0 ? (
          <p className="text-ink/75 dark:text-paper/75">No pull requests are waiting for your review.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.data.recent.map((item) => {
              const status = submissionLabel(item.status);
              const review = reviewLabel(item.reviewState);
              return (
                <li key={item.submissionId}>
                  <Link
                    href={`/mentor/pull-requests/${item.submissionId}`}
                    className={`block rounded-2xl border border-ink/10 px-4 py-3 dark:border-paper/10 ${focusRing}`}
                  >
                    <span className="font-medium">{item.studentName}</span>
                    <span className="mt-1 block text-sm text-ink/70 dark:text-paper/70">
                      {item.repository}
                      {" · "}
                      {item.techStack}
                      {" · "}
                      {status.label}
                      {" · "}
                      {review.label}
                      {" · "}
                      <time dateTime={item.submittedAt.toISOString()}>{formatTimestamp(item.submittedAt)}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </MentorSection>
  );
}
