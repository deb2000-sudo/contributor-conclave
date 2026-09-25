"use client";

import { useId, useRef, type ReactNode } from "react";

import { focusRing } from "@/components/ui/styles";

export function Dialog({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className={`inline-flex h-10 items-center rounded-full border border-ink/20 px-4 text-sm font-medium dark:border-paper/25 ${focusRing}`}
        onClick={() => {
          dialogRef.current?.showModal();
          titleRef.current?.focus();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-ink/15 bg-paper p-6 text-ink backdrop:bg-ink/60 dark:border-paper/15 dark:bg-ink dark:text-paper"
      >
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className={`text-xl font-semibold ${focusRing}`}>
          {title}
        </h2>
        <div className="mt-3 text-ink/80 dark:text-paper/80">{children}</div>
        <form method="dialog" className="mt-6">
          <button
            type="submit"
            className={`inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper dark:bg-paper dark:text-ink ${focusRing}`}
          >
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
