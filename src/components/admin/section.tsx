import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusNote } from "@/components/ui/status-note";

export function AdminSection({
  title,
  description,
  crumb,
  children,
}: {
  title: string;
  description: string;
  crumb?: string;
  children?: ReactNode;
}) {
  const items = crumb
    ? [
        { href: "/", label: "Home" },
        { href: "/admin", label: "Overview" },
        { label: crumb },
      ]
    : [{ href: "/", label: "Home" }, { label: "Overview" }];

  return (
    <main className="flex flex-col gap-6">
      <Breadcrumbs items={items} />
      <PageHeader eyebrow="Administrator" title={title} description={description} />
      {children}
    </main>
  );
}

export function AdminNote({ children }: { children: string }) {
  return <StatusNote>{children}</StatusNote>;
}
