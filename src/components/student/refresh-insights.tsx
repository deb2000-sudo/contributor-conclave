"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { focusRing } from "@/components/ui/styles";

export function RefreshInsights() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={`inline-flex h-9 items-center gap-2 rounded-full border border-ink/20 px-3 text-sm dark:border-paper/25 ${focusRing}`}
    >
      <span aria-hidden="true" className={pending ? "motion-safe:animate-spin" : undefined}>
        ↻
      </span>
      {pending ? "Refreshing" : "Refresh"}
    </button>
  );
}
