import type { ReactNode } from "react";
import Link from "next/link";

import { controlClass, focusRing } from "@/components/ui/styles";

export function AdminFilters({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3">
      {children}
      <button
        type="submit"
        className={`inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper dark:bg-paper dark:text-ink ${focusRing}`}
      >
        Apply
      </button>
      <Link href={action} className={`text-sm underline underline-offset-4 ${focusRing}`}>
        Clear
      </Link>
    </form>
  );
}

export function SearchFilter({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="flex min-w-48 flex-col gap-1">
      <label htmlFor="admin-search" className="text-sm font-medium">
        Search
      </label>
      <input id="admin-search" name="q" defaultValue={defaultValue} className={controlClass} />
    </div>
  );
}

export function ChoiceFilter({
  id,
  label,
  name,
  value,
  options,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} className={controlClass}>
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
