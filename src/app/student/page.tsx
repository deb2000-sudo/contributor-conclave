import { Suspense } from "react";

import { FactList } from "@/components/student/fact-list";
import { GitHubStatistics } from "@/components/student/github-statistics";
import { StudentSection } from "@/components/student/student-section";
import { SubmissionTable } from "@/components/student/submission-table";
import { TextLink } from "@/components/student/text-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStudent } from "@/lib/auth/authorization";
import { normalizeGitHubUsername } from "@/lib/github/parse";
import { getStudentAccount, getStudentOverviewLists } from "@/lib/student/dashboard";
import { reviewLabel } from "@/lib/student/labels";

export const metadata = { title: "Overview" };

export default async function StudentOverviewPage() {
  const user = await requireStudent();
  const student = await getStudentAccount(user.id);

  if (!student) {
    return (
      <StudentSection
        crumb="Overview"
        title="Overview"
        description="Your student profile could not be loaded."
      >
        <ErrorState
          title="Student profile missing"
          message="This account has the student role and no student profile."
        />
      </StudentSection>
    );
  }

  const name = `${student.firstName} ${student.lastName}`;
  const username = student.githubUsername;
  const login = username ? normalizeGitHubUsername(username) : null;
  const githubHref = login ? `https://github.com/${login}` : "";

  return (
    <StudentSection
      crumb="Overview"
      title={name}
      description="A snapshot of your mentorship and the GitHub account linked to you."
    >
      <FactList
        facts={[
          { label: "GitHub username", value: username ? <TextLink href={githubHref}>{username}</TextLink> : "None saved" },
          { label: "University", value: student.universityName },
          { label: "Batch", value: student.batch },
          { label: "Email", value: student.email },
        ]}
      />

      <Suspense fallback={<LoadingState label="Loading submissions" />}>
        <OverviewActivity userId={user.id} />
      </Suspense>

      <Suspense fallback={<LoadingState label="Loading GitHub statistics" />}>
        <GitHubStatistics username={username} />
      </Suspense>
    </StudentSection>
  );
}

async function OverviewActivity({ userId }: { userId: string }) {
  const activity = await getStudentOverviewLists(userId);
  if (!activity) {
    return null;
  }

  const { counts } = activity;
  const total = counts.pending + counts.approved + counts.changes;

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Review status</h2>
        {total === 0 ? (
          <EmptyState
            title="No submitted pull requests"
            description="Review status appears here after you submit a pull request for mentorship."
          />
        ) : (
          <>
            <dl className="flex flex-wrap gap-3">
              <div>
                <dt className="sr-only">Pending</dt>
                <dd>
                  <StatusBadge tone="pending">{`${counts.pending} pending`}</StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Approved</dt>
                <dd>
                  <StatusBadge tone="approved">{`${counts.approved} approved`}</StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Changes requested</dt>
                <dd>
                  <StatusBadge tone="changes">{`${counts.changes} changes requested`}</StatusBadge>
                </dd>
              </div>
            </dl>
            <SubmissionTable submissions={activity.submissions} caption="Recent submitted pull requests" />
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Current mentor</h2>
        {activity.mentors.length === 0 ? (
          <EmptyState
            title="No mentor assigned"
            description="A mentor is assigned to a pull request you submit for review."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {activity.mentors.map((mentor) => {
              const review = reviewLabel(mentor.reviewState);
              return (
                <li
                  key={mentor.assignmentId}
                  className="rounded-2xl border border-ink/10 px-4 py-3 dark:border-paper/10"
                >
                  <p className="font-medium">{mentor.name}</p>
                  <p className="text-sm text-ink/75 dark:text-paper/75">{mentor.repository}</p>
                  <p className="mt-2">
                    <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
