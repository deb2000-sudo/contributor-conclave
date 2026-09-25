import { AdminFilters, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminSection } from "@/components/admin/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { auditActionLabel } from "@/lib/admin/labels";
import { pageQuery, readPage, readText } from "@/lib/admin/query";
import { listAuditLogs } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";
import { formatTimestamp } from "@/lib/student/labels";

export const metadata = { title: "Audit logs" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const result = await listAuditLogs(admin.id, { page: readPage(params.page), search });

  if (!result.ok) {
    return (
      <AdminSection crumb="Audit logs" title="Audit logs" description="Security-sensitive changes.">
        <ErrorState title="Audit log unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) => `/admin/audit${pageQuery(page, { q: search })}`;

  return (
    <AdminSection crumb="Audit logs" title="Audit logs" description="Status changes, approvals, and assignments, newest first.">
      <AdminFilters action="/admin/audit">
        <SearchFilter defaultValue={search} />
      </AdminFilters>
      <DataTable
        caption="Audit logs"
        emptyTitle="No audit events"
        emptyDescription="Account changes, mentor decisions, and assignments are recorded here."
        columns={[
          { key: "when", header: "When" },
          { key: "actor", header: "Actor" },
          { key: "action", header: "Action" },
          { key: "detail", header: "Detail" },
        ]}
        rows={result.data.items.map((log) => ({
          id: log.id,
          when: <time dateTime={log.createdAt.toISOString()}>{formatTimestamp(log.createdAt)}</time>,
          actor: log.actorName,
          action: auditActionLabel(log.action),
          detail: log.detail ?? log.targetType,
        }))}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
