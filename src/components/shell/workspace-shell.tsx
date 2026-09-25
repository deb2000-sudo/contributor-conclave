import type { ReactNode } from "react";

import { Sidebar } from "@/components/shell/sidebar";

export function WorkspaceShell({
  label,
  items,
  children,
}: {
  label: string;
  items: { href: string; label: string; section?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:flex-row">
      <Sidebar label={label} items={items} />
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
