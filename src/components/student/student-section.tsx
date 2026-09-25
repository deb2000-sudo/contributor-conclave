import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

export function StudentSection({
  crumb,
  title,
  description,
  children,
}: {
  crumb: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const items =
    crumb === "Overview"
      ? [{ href: "/", label: "Home" }, { label: "Overview" }]
      : [
          { href: "/", label: "Home" },
          { href: "/student", label: "Overview" },
          { label: crumb },
        ];

  return (
    <main className="flex flex-col gap-8">
      <Breadcrumbs items={items} />
      <PageHeader eyebrow="Student" title={title} description={description} />
      {children}
    </main>
  );
}
