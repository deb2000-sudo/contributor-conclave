import { StudentSection } from "@/components/student/student-section";
import { TextLink } from "@/components/student/text-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStudent } from "@/lib/auth/authorization";
import { normalizeGitHubUsername } from "@/lib/github/parse";
import { getStudentMentors } from "@/lib/student/dashboard";
import { reviewLabel } from "@/lib/student/labels";

export const metadata = { title: "Mentor" };

export default async function StudentMentorPage() {
  const user = await requireStudent();
  const mentors = await getStudentMentors(user.id);

  if (!mentors) {
    return (
      <StudentSection crumb="Mentor" title="Mentor" description="Mentors assigned to your pull requests.">
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  return (
    <StudentSection
      crumb="Mentor"
      title="Mentor"
      description="Mentors with an active assignment on a pull request you submitted."
    >
      {mentors.length === 0 ? (
        <EmptyState
          title="No mentor assigned"
          description="An active mentor assignment appears here with the pull request and its review status."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {mentors.map((mentor) => {
            const review = reviewLabel(mentor.reviewState);
            const githubHref =
              mentor.githubUsername && normalizeGitHubUsername(mentor.githubUsername)
                ? `https://github.com/${normalizeGitHubUsername(mentor.githubUsername)}`
                : "";
            return (
              <li
                key={mentor.assignmentId}
                className="rounded-2xl border border-ink/10 px-4 py-4 dark:border-paper/10"
              >
                <h2 className="text-lg font-semibold">{mentor.name}</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-ink/70 dark:text-paper/70">Email</dt>
                    <dd className="break-words">{mentor.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink/70 dark:text-paper/70">GitHub</dt>
                    <dd>
                      {mentor.githubUsername ? (
                        <TextLink href={githubHref}>{mentor.githubUsername}</TextLink>
                      ) : (
                        "None saved"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink/70 dark:text-paper/70">Pull request</dt>
                    <dd>
                      <TextLink href={mentor.githubPrUrl}>{mentor.repository}</TextLink>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink/70 dark:text-paper/70">Review status</dt>
                    <dd className="mt-1">
                      <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </StudentSection>
  );
}
