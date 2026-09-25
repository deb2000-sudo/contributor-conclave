import { CreateTechStackForm, RenameTechStackForm } from "@/components/admin/forms";
import { AdminFilters, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { AdminNote, AdminSection } from "@/components/admin/section";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { pageQuery, readPage, readText } from "@/lib/admin/query";
import { listTechStacks } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Tech stacks" };

export default async function AdminTechStacksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; updated?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = readText(params.q);
  const result = await listTechStacks(admin.id, { page: readPage(params.page), search });

  if (!result.ok) {
    return (
      <AdminSection crumb="Tech stacks" title="Tech stacks" description="Stacks students can choose.">
        <ErrorState title="Tech stacks unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const href = (page: number) => `/admin/tech-stacks${pageQuery(page, { q: search })}`;

  return (
    <AdminSection crumb="Tech stacks" title="Tech stacks" description="Add a stack or rename one students and mentors already use.">
      {params.updated === "1" ? <AdminNote>The tech stack was saved.</AdminNote> : null}
      <CreateTechStackForm />
      <AdminFilters action="/admin/tech-stacks">
        <SearchFilter defaultValue={search} />
      </AdminFilters>
      <DataTable
        caption="Tech stacks"
        emptyTitle="No tech stacks"
        emptyDescription="Add a tech stack before students submit pull requests."
        columns={[
          { key: "name", header: "Name" },
          { key: "submissions", header: "Submissions" },
          { key: "mentors", header: "Mentors" },
        ]}
        rows={result.data.items.map((stack) => ({
          id: stack.id,
          name: <RenameTechStackForm id={stack.id} name={stack.name} />,
          submissions: String(stack.submissionCount),
          mentors: String(stack.mentorCount),
        }))}
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </AdminSection>
  );
}
