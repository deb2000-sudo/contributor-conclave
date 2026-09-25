import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StudentSubmission } from "@/lib/student/dashboard";
import { formatTimestamp, reviewLabel, submissionLabel } from "@/lib/student/labels";

export function SubmissionTable({
  submissions,
  caption,
}: {
  submissions: StudentSubmission[];
  caption: string;
}) {
  return (
    <DataTable
      caption={caption}
      emptyTitle="No pull requests submitted"
      emptyDescription="Pull requests you submit for mentorship will be listed here."
      columns={[
        { key: "repository", header: "Repository" },
        { key: "pullRequest", header: "Pull request" },
        { key: "techStack", header: "Tech stack" },
        { key: "status", header: "Status" },
        { key: "review", header: "Review" },
        { key: "mentor", header: "Mentor" },
        { key: "submitted", header: "Submitted" },
      ]}
      rows={submissions.map((submission) => {
        const review = reviewLabel(submission.reviewState);
        const status = submissionLabel(submission.status);
        return {
          id: submission.id,
          repository: submission.repository,
          pullRequest: <TextLink href={submission.githubPrUrl}>Open pull request</TextLink>,
          techStack: submission.techStack,
          status: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
          review: <StatusBadge tone={review.tone}>{review.label}</StatusBadge>,
          mentor: submission.mentorName ?? "Unassigned",
          submitted: (
            <time dateTime={submission.submittedAt.toISOString()}>
              {formatTimestamp(submission.submittedAt)}
            </time>
          ),
        };
      })}
    />
  );
}
