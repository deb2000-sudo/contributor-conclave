import Link from "next/link";

import { AdminFilters, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { MentorSection } from "@/components/mentor/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { focusRing } from "@/components/ui/styles";
import { requireMentor } from "@/lib/auth/authorization";
import { listAssignedStudents } from "@/lib/mentor/directory";
import { pageQuery, readPage, readText } from "@/lib/mentor/query";

export const metadata = { title: "Assigned students" };

export default async function MentorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const mentor = await requireMentor();
  const params = await searchParams;
  const search = readText(params.q);
  const result = await listAssignedStudents(mentor.id, { page: readPage(params.page), search });

  if (!result.ok) {
    return (
      <MentorSection
        crumb="Assigned students"
        title="Assigned students"
        description="Students with a pull request currently assigned to you."
      >
        <ErrorState title="Students unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const href = (page: number) => `/mentor/students${pageQuery(page, { q: search || null })}`;

  return (
    <MentorSection
      crumb="Assigned students"
      title="Assigned students"
      description="Students with a pull request currently assigned to you."
    >
      <AdminFilters action="/mentor/students">
        <SearchFilter defaultValue={search} />
      </AdminFilters>
      <DataTable
        caption="Assigned students"
        emptyTitle="No assigned students"
        emptyDescription="A student appears here after an administrator assigns their pull request to you."
        columns={[
          { key: "name", header: "Student" },
          { key: "batch", header: "Batch" },
          { key: "university", header: "University" },
          { key: "count", header: "Assigned pull requests" },
        ]}
        rows={result.data.items.map((student) => ({
          id: student.userId,
          name: (
            <Link href={`/mentor/students/${student.userId}`} className={`underline underline-offset-4 ${focusRing}`}>
              {student.name}
            </Link>
          ),
          batch: student.batch,
          university: student.universityName,
          count: String(student.assignmentCount),
        }))}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </MentorSection>
  );
}
