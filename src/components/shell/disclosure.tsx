"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [pathname]);

  return (
    <details
      ref={detailsRef}
      className={className}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !detailsRef.current?.open) {
          return;
        }
        event.preventDefault();
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
      }}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
