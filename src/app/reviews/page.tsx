import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

const columns = [
  { key: "pull", header: "Pull request" },
  { key: "stack", header: "Stack" },
  { key: "status", header: "Review" },
];

export default function ReviewsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Reviews" }]} />
      <PageHeader
        eyebrow="Pull request review"
        title="The review lives with the change"
        description="A submission carries the GitHub pull request, the repository, and the state of the review. Nothing is listed here until someone submits one."
      />
      <ul className="flex flex-wrap gap-2" aria-label="Review states">
        <li>
          <StatusBadge tone="pending">Pending</StatusBadge>
        </li>
        <li>
          <StatusBadge tone="changes">Changes requested</StatusBadge>
        </li>
        <li>
          <StatusBadge tone="approved">Approved</StatusBadge>
        </li>
        <li>
          <StatusBadge tone="closed">Closed</StatusBadge>
        </li>
      </ul>
      <Dialog label="What a review includes" title="What a review includes">
        <p>
          A mentor records a decision and a comment. The student sees that note beside the
          pull request, then continues the thread if something is still unclear.
        </p>
      </Dialog>
      <DataTable
        caption="Pull request reviews"
        columns={columns}
        rows={[]}
        emptyTitle="No reviews yet"
        emptyDescription="Submitted pull requests will appear in this table once the review workflow is connected."
      />
    </main>
  );
}
