import { Pager } from "@/components/admin/pager";
import { PullRequestTable } from "@/components/mentor/pull-request-table";
import { MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { listPendingReviews } from "@/lib/mentor/directory";
import { pageQuery, readPage } from "@/lib/mentor/query";

export const metadata = { title: "Pending reviews" };

export default async function MentorReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const mentor = await requireMentor();
  const params = await searchParams;
  const result = await listPendingReviews(mentor.id, { page: readPage(params.page) });

  if (!result.ok) {
    return (
      <MentorSection
        crumb="Pending reviews"
        title="Pending reviews"
        description="Assigned pull requests that still need a review decision."
      >
        <ErrorState title="Reviews unavailable" message={result.message} />
      </MentorSection>
    );
  }

  return (
    <MentorSection
      crumb="Pending reviews"
      title="Pending reviews"
      description="Assigned pull requests that still need a review decision."
    >
      <PullRequestTable
        items={result.data.items}
        emptyTitle="No pending reviews"
        emptyDescription="Assigned pull requests with a pending review will appear here."
      />
      <Pager
        page={result.data.page}
        total={result.data.total}
        pageSize={result.data.pageSize}
        href={(page) => `/mentor/reviews${pageQuery(page, {})}`}
      />
    </MentorSection>
  );
}
