import Link from "next/link";

import { Pager } from "@/components/admin/pager";
import { TextLink } from "@/components/student/text-link";
import { MentorSection } from "@/components/mentor/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { focusRing } from "@/components/ui/styles";
import { requireMentor } from "@/lib/auth/authorization";
import { pageQuery, readPage } from "@/lib/mentor/query";
import { listReviewHistory } from "@/lib/mentor/reviews";
import { formatTimestamp, reviewLabel, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Review history" };

export default async function MentorHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const mentor = await requireMentor();
  const params = await searchParams;
  const result = await listReviewHistory(mentor.id, { page: readPage(params.page) });

  if (!result.ok) {
    return (
      <MentorSection crumb="Review history" title="Review history" description="Reviews you have written.">
        <ErrorState title="History unavailable" message={result.message} />
      </MentorSection>
    );
  }

  return (
    <MentorSection crumb="Review history" title="Review history" description="Reviews you have written.">
      <DataTable
        caption="Review history"
        emptyTitle="No reviews yet"
        emptyDescription="Approve a pull request or request changes to record a review."
        columns={[
          { key: "student", header: "Student" },
          { key: "repository", header: "Repository" },
          { key: "pull", header: "Pull request" },
          { key: "stack", header: "Tech stack" },
          { key: "submitted", header: "Submission date" },
          { key: "status", header: "Current status" },
          { key: "review", header: "Review status" },
          { key: "comment", header: "Comment" },
        ]}
        rows={result.data.items.map((item) => {
          const status = submissionLabel(item.status);
          const review = reviewLabel(item.decision);
          return {
            id: item.id,
            student: item.stillAssigned ? (
              <Link
                href={`/mentor/students/${item.studentUserId}`}
                className={`underline underline-offset-4 ${focusRing}`}
              >
                {item.studentName}
              </Link>
            ) : (
              item.studentName
            ),
            repository: item.repository,
            pull: item.stillAssigned ? (
              <span className="flex flex-col gap-1">
                <Link
                  href={`/mentor/pull-requests/${item.submissionId}`}
                  className={`underline underline-offset-4 ${focusRing}`}
                >
                  Review
                </Link>
                <TextLink href={item.githubPrUrl}>Open pull request</TextLink>
              </span>
            ) : (
              <TextLink href={item.githubPrUrl}>Open pull request</TextLink>
            ),
            stack: item.techStack,
            submitted: <time dateTime={item.submittedAt.toISOString()}>{formatTimestamp(item.submittedAt)}</time>,
            status: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
            review: (
              <span className="flex flex-col gap-1">
                <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                <time dateTime={item.createdAt.toISOString()}>{formatTimestamp(item.createdAt)}</time>
              </span>
            ),
            comment: <span className="break-words whitespace-pre-wrap">{item.comment}</span>,
          };
        })}
      />
      <Pager
        page={result.data.page}
        total={result.data.total}
        pageSize={result.data.pageSize}
        href={(page) => `/mentor/history${pageQuery(page, {})}`}
      />
    </MentorSection>
  );
}
