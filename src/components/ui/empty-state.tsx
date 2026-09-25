export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 px-6 py-10 dark:border-paper/20">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-xl text-ink/75 dark:text-paper/75">{description}</p>
    </div>
  );
}
