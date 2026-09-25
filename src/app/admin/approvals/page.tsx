import Link from "next/link";

import { MentorDecisionForm } from "@/components/admin/forms";
import { AdminFilters, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminNote, AdminSection } from "@/components/admin/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { listMentors } from "@/lib/admin/people";
import { pageQuery, readPage, readText } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Mentor approvals" };

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; updated?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const result = await listMentors(admin.id, {
    page: readPage(params.page),
    search,
    account: "all",
    approval: "PENDING",
  });

  if (!result.ok) {
    return (
      <AdminSection crumb="Mentor approvals" title="Mentor approvals" description="Mentors waiting for a decision.">
        <ErrorState title="Approvals unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) => `/admin/approvals${pageQuery(page, { q: search })}`;

  return (
    <AdminSection
      crumb="Mentor approvals"
      title="Mentor approvals"
      description="Approve or reject mentors before they can be assigned."
    >
      {params.updated === "1" ? <AdminNote>The mentor decision was saved.</AdminNote> : null}
      <AdminFilters action="/admin/approvals">
        <SearchFilter defaultValue={search} />
      </AdminFilters>
      <DataTable
        caption="Mentors awaiting approval"
        emptyTitle="No mentors waiting"
        emptyDescription="New mentor registrations appear here until you approve or reject them."
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "employee", header: "Employee ID" },
          { key: "decision", header: "Decision" },
        ]}
        rows={result.data.items.map((mentor) => ({
          id: mentor.id,
          name: (
            <Link href={`/admin/mentors/${mentor.id}`} className="underline underline-offset-4">
              {mentor.name}
            </Link>
          ),
          email: mentor.email,
          employee: mentor.employeeId,
          decision: <MentorDecisionForm userId={mentor.id} returnTo="/admin/approvals" />,
        }))}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
