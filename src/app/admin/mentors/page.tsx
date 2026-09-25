import Link from "next/link";

import { MentorDecisionForm } from "@/components/admin/forms";
import { AdminFilters, ChoiceFilter, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminSection } from "@/components/admin/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { accountLabel, approvalLabel } from "@/lib/admin/labels";
import { listMentors } from "@/lib/admin/people";
import { pageQuery, readAccount, readApproval, readPage, readText } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Mentors" };

export default async function AdminMentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; account?: string; approval?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const account = readAccount(params.account);
  const approval = readApproval(params.approval);
  const result = await listMentors(admin.id, {
    page: readPage(params.page),
    search,
    account,
    approval,
  });

  if (!result.ok) {
    return (
      <AdminSection crumb="Mentors" title="Mentors" description="Mentor accounts.">
        <ErrorState title="Mentors unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) =>
    `/admin/mentors${pageQuery(page, {
      q: search,
      account: account === "all" ? null : account,
      approval: approval === "all" ? null : approval,
    })}`;

  return (
    <AdminSection crumb="Mentors" title="Mentors" description="Search mentors, then approve, reject, or update them.">
      <AdminFilters action="/admin/mentors">
        <SearchFilter defaultValue={search} />
        <ChoiceFilter
          id="mentor-account"
          name="account"
          label="Account"
          value={account}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "deactivated", label: "Deactivated" },
          ]}
        />
        <ChoiceFilter
          id="mentor-approval"
          name="approval"
          label="Approval"
          value={approval}
          options={[
            { value: "all", label: "All" },
            { value: "PENDING", label: "Pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </AdminFilters>
      <DataTable
        caption="Mentors"
        emptyTitle="No mentors"
        emptyDescription="Mentor accounts appear here after registration."
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "employee", header: "Employee ID" },
          { key: "approval", header: "Approval" },
          { key: "account", header: "Account" },
          { key: "view", header: "View" },
        ]}
        rows={result.data.items.map((mentor) => {
          const approvalState = approvalLabel(mentor.approvalStatus);
          const accountState = accountLabel(mentor.deactivatedAt);
          return {
            id: mentor.id,
            name: mentor.name,
            email: mentor.email,
            employee: mentor.employeeId,
            approval: <StatusBadge tone={approvalState.tone}>{approvalState.label}</StatusBadge>,
            account: <StatusBadge tone={accountState.tone}>{accountState.label}</StatusBadge>,
            view: (
              <Link href={`/admin/mentors/${mentor.id}`} className="underline underline-offset-4">
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
