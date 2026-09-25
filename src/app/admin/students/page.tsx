import Link from "next/link";

import { AdminFilters, ChoiceFilter, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminSection } from "@/components/admin/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { accountLabel } from "@/lib/admin/labels";
import { listStudents } from "@/lib/admin/people";
import { pageQuery, readAccount, readPage, readText } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Students" };

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; account?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const account = readAccount(params.account);
  const result = await listStudents(admin.id, { page: readPage(params.page), search, account });

  if (!result.ok) {
    return (
      <AdminSection crumb="Students" title="Students" description="Student accounts.">
        <ErrorState title="Students unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) =>
    `/admin/students${pageQuery(page, { q: search, account: account === "all" ? null : account })}`;

  return (
    <AdminSection crumb="Students" title="Students" description="Search, filter, and open a student account.">
      <AdminFilters action="/admin/students">
        <SearchFilter defaultValue={search} />
        <ChoiceFilter
          id="student-account"
          name="account"
          label="Account"
          value={account}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "deactivated", label: "Deactivated" },
          ]}
        />
      </AdminFilters>
      <DataTable
        caption="Students"
        emptyTitle="No students"
        emptyDescription="Student accounts appear here after registration."
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "university", header: "University" },
          { key: "batch", header: "Batch" },
          { key: "account", header: "Account" },
          { key: "view", header: "View" },
        ]}
        rows={result.data.items.map((student) => {
          const status = accountLabel(student.deactivatedAt);
          return {
            id: student.id,
            name: student.name,
            email: student.email,
            university: student.universityName,
            batch: student.batch,
            account: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
            view: (
              <Link href={`/admin/students/${student.id}`} className="underline underline-offset-4">
                View
              </Link>
            ),
          };
        })}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
