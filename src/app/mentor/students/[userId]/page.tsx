import { FactList } from "@/components/student/fact-list";
import { TextLink } from "@/components/student/text-link";
import { PullRequestTable } from "@/components/mentor/pull-request-table";
import { MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { normalizeGitHubUsername } from "@/lib/github/parse";
import { getAssignedStudent } from "@/lib/mentor/directory";

export const metadata = { title: "Assigned student" };

export default async function MentorStudentPage({ params }: { params: Promise<{ userId: string }> }) {
  const mentor = await requireMentor();
  const { userId } = await params;
  const result = await getAssignedStudent(mentor.id, userId);

  if (!result.ok) {
    return (
      <MentorSection crumb="Assigned students" title="Assigned student" description="A student assigned to you.">
        <ErrorState title="Student unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const student = result.data;
  const login = student.githubUsername ? normalizeGitHubUsername(student.githubUsername) : null;

  return (
    <MentorSection
      crumb="Assigned students"
      title={student.name}
      description="Profile details and the pull requests currently assigned to you."
    >
      <FactList
        facts={[
          { label: "Email", value: student.email },
          { label: "University", value: student.universityName },
          { label: "Batch", value: student.batch },
          {
            label: "GitHub username",
            value: login ? <TextLink href={`https://github.com/${login}`}>{login}</TextLink> : "None saved",
          },
        ]}
      />
      {student.pullRequestCount > student.pullRequests.length ? (
        <p className="text-sm text-ink/70 dark:text-paper/70">
          Showing {student.pullRequests.length} of {student.pullRequestCount} assigned pull requests.
        </p>
      ) : null}
      <PullRequestTable
        items={student.pullRequests}
        emptyTitle="No assigned pull requests"
        emptyDescription="This student has no pull request currently assigned to you."
      />
    </MentorSection>
  );
}
