"use client";

import { useEffect, useRef } from "react";

import { focusRing } from "@/components/ui/styles";

export function StatusNote({ children }: { children: string }) {
  const noteRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    noteRef.current?.focus();
  }, []);

  return (
    <p
      ref={noteRef}
      role="status"
      tabIndex={-1}
      data-route-status=""
      className={`rounded-2xl border border-moss-700/40 px-4 py-3 text-sm text-moss-900 dark:text-moss-100 ${focusRing}`}
    >
      {children}
    </p>
  );
}
