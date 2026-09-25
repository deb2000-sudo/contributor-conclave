import Link from "next/link";

import { AdminFilters, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminSection } from "@/components/admin/section";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { assignmentLabel } from "@/lib/admin/labels";
import { pageQuery, readPage, readText } from "@/lib/admin/query";
import { listAssignments } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";
import { formatTimestamp } from "@/lib/student/labels";

export const metadata = { title: "Assignments" };

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const result = await listAssignments(admin.id, { page: readPage(params.page), search });

  if (!result.ok) {
    return (
      <AdminSection crumb="Assignments" title="Assignments" description="Mentors assigned to pull requests.">
        <ErrorState title="Assignments unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) => `/admin/assignments${pageQuery(page, { q: search })}`;

  return (
    <AdminSection
      crumb="Assignments"
      title="Assignments"
      description="Each row is a mentor assigned to a student pull request."
    >
      <AdminFilters action="/admin/assignments">
        <SearchFilter defaultValue={search} />
      </AdminFilters>
      <DataTable
        caption="Mentor assignments"
        emptyTitle="No assignments"
        emptyDescription="Assignments appear here after you assign a mentor to a submission."
        columns={[
          { key: "student", header: "Student" },
          { key: "mentor", header: "Mentor" },
          { key: "repository", header: "Repository" },
          { key: "status", header: "Status" },
          { key: "created", header: "Created" },
        ]}
        rows={result.data.items.map((assignment) => ({
          id: assignment.id,
          student: assignment.studentName,
          mentor: assignment.mentorName,
          repository: (
            <span className="flex flex-col gap-1">
              <Link href={`/admin/submissions/${assignment.submissionId}`} className="underline underline-offset-4">
                {assignment.repository}
              </Link>
              <TextLink href={assignment.githubPrUrl}>Open pull request</TextLink>
            </span>
          ),
          status: assignmentLabel(assignment.status),
          created: (
            <time dateTime={assignment.createdAt.toISOString()}>{formatTimestamp(assignment.createdAt)}</time>
          ),
        }))}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
