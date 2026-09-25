import Link from "next/link";

import { AdminFilters, ChoiceFilter, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminSection } from "@/components/admin/section";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { pageQuery, readOptionalUuid, readPage, readSubmissionStatus, readText } from "@/lib/admin/query";
import { listSubmissions, listTechStackOptions } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";
import { PRSubmissionStatus } from "@/generated/prisma/client";
import { formatTimestamp, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "PR submissions" };

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; techStack?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const status = readSubmissionStatus(params.status);
  const techStackId = readOptionalUuid(params.techStack);
  const [result, stacks] = await Promise.all([
    listSubmissions(admin.id, { page: readPage(params.page), search, status, techStackId }),
    listTechStackOptions(admin.id),
  ]);

  if (!result.ok) {
    return (
      <AdminSection crumb="PR submissions" title="PR submissions" description="Pull requests submitted for review.">
        <ErrorState title="Submissions unavailable" message={result.message} />
      </AdminSection>
    );
  }

  if (!stacks.ok) {
    return (
      <AdminSection crumb="PR submissions" title="PR submissions" description="Pull requests submitted for review.">
        <ErrorState title="Submissions unavailable" message={stacks.message} />
      </AdminSection>
    );
  }

  const href = (page: number) =>
    `/admin/submissions${pageQuery(page, {
      q: search,
      status: status === "all" ? null : status,
      techStack: techStackId,
    })}`;

  return (
    <AdminSection
      crumb="PR submissions"
      title="PR submissions"
      description="Filter by tech stack or status, then assign a mentor."
    >
      <AdminFilters action="/admin/submissions">
        <SearchFilter defaultValue={search} />
        <ChoiceFilter
          id="submission-status"
          name="status"
          label="Status"
          value={status}
          options={[
            { value: "all", label: "All" },
            ...Object.values(PRSubmissionStatus).map((value) => ({
              value,
              label: submissionLabel(value).label,
            })),
          ]}
        />
        <ChoiceFilter
          id="submission-stack"
          name="techStack"
          label="Tech stack"
          value={techStackId ?? ""}
          options={[
            { value: "", label: "All" },
            ...stacks.data.map((stack) => ({ value: stack.id, label: stack.name })),
          ]}
        />
      </AdminFilters>
      <DataTable
        caption="Pull request submissions"
        emptyTitle="No submissions"
        emptyDescription="A pull request appears here after a student submits it."
        columns={[
          { key: "student", header: "Student" },
          { key: "repository", header: "Repository" },
          { key: "pull", header: "Pull request" },
          { key: "stack", header: "Tech stack" },
          { key: "status", header: "Status" },
          { key: "submitted", header: "Submitted" },
        ]}
        rows={result.data.items.map((submission) => {
          const label = submissionLabel(submission.status);
          return {
            id: submission.id,
            student: (
              <Link href={`/admin/students/${submission.studentId}`} className="underline underline-offset-4">
                {submission.studentName}
              </Link>
            ),
            repository: submission.repository,
            pull: (
              <Link href={`/admin/submissions/${submission.id}`} className="underline underline-offset-4">
                View
              </Link>
            ),
            stack: submission.techStack,
            status: <StatusBadge tone={label.tone}>{label.label}</StatusBadge>,
            submitted: (
              <span className="flex flex-col gap-1">
                <time dateTime={submission.submittedAt.toISOString()}>{formatTimestamp(submission.submittedAt)}</time>
                <TextLink href={submission.githubPrUrl}>Open pull request</TextLink>
              </span>
            ),
          };
        })}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
