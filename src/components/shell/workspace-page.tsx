import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export function WorkspacePage({
  crumbs,
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  crumbs: { href?: string; label: string }[];
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <main className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </main>
  );
}
