import Link from "next/link";

import { focusRing } from "@/components/ui/styles";

export function Pager({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>
        {total} {total === 1 ? "result" : "results"}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-3">
          {page > 1 ? (
            <Link href={href(page - 1)} className={`underline underline-offset-4 ${focusRing}`}>
              Previous
            </Link>
          ) : (
            <button type="button" disabled className="text-ink/70 disabled:opacity-100 dark:text-paper/70">
              Previous
            </button>
          )}
          <p>
            Page {page} of {pages}
          </p>
          {page < pages ? (
            <Link href={href(page + 1)} className={`underline underline-offset-4 ${focusRing}`}>
              Next
            </Link>
          ) : (
            <button type="button" disabled className="text-ink/70 disabled:opacity-100 dark:text-paper/70">
              Next
            </button>
          )}
        </div>
      ) : null}
    </nav>
  );
}
