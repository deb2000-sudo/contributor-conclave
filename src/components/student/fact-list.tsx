import type { ReactNode } from "react";

export function FactList({
  facts,
}: {
  facts: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="border-t border-ink/10 pt-3 dark:border-paper/10">
          <dt className="text-sm text-ink/70 dark:text-paper/70">{fact.label}</dt>
          <dd className="mt-1 font-medium break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-ink/10 px-4 py-4 dark:border-paper/10"
        >
          <dt className="text-sm text-ink/70 dark:text-paper/70">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
