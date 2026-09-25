import Link from "next/link";

import type { AssignedPullRequest } from "@/lib/mentor/directory";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { focusRing } from "@/components/ui/styles";
import { formatTimestamp, reviewLabel, submissionLabel } from "@/lib/student/labels";

export function PullRequestTable({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: AssignedPullRequest[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <DataTable
      caption="Assigned pull requests"
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      columns={[
        { key: "student", header: "Student" },
        { key: "repository", header: "Repository" },
        { key: "pull", header: "Pull request" },
        { key: "stack", header: "Tech stack" },
        { key: "submitted", header: "Submission date" },
        { key: "status", header: "Current status" },
        { key: "review", header: "Review status" },
      ]}
      rows={items.map((item) => {
        const status = submissionLabel(item.status);
        const review = reviewLabel(item.reviewState);
        return {
          id: item.submissionId,
          student: (
            <Link
              href={`/mentor/students/${item.studentUserId}`}
              className={`underline underline-offset-4 ${focusRing}`}
            >
              {item.studentName}
            </Link>
          ),
          repository: item.repository,
          pull: (
            <span className="flex flex-col gap-1">
              <Link
                href={`/mentor/pull-requests/${item.submissionId}`}
                className={`underline underline-offset-4 ${focusRing}`}
              >
                Review
              </Link>
              <TextLink href={item.githubPrUrl}>Open pull request</TextLink>
            </span>
          ),
          stack: item.techStack,
          submitted: (
            <time dateTime={item.submittedAt.toISOString()}>{formatTimestamp(item.submittedAt)}</time>
          ),
          status: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
          review: <StatusBadge tone={review.tone}>{review.label}</StatusBadge>,
        };
      })}
    />
  );
}
