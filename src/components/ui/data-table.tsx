import { useId, type ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { focusRing } from "@/components/ui/styles";

export type DataColumn = {
  key: string;
  header: string;
};

export function DataTable({
  caption,
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  caption: string;
  columns: DataColumn[];
  rows: Array<{ id: string } & Record<string, ReactNode>>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const captionId = useId();

  return (
    <div tabIndex={0} role="region" aria-labelledby={captionId} className={`overflow-x-auto ${focusRing}`}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-ink/15 dark:border-paper/15">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-3 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-ink/10 dark:border-paper/10">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
