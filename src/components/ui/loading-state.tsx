export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-8">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-48 rounded bg-ink/10 motion-safe:animate-pulse dark:bg-paper/10" />
      <div className="h-4 w-full max-w-md rounded bg-ink/10 motion-safe:animate-pulse dark:bg-paper/10" />
      <div className="h-4 w-2/3 max-w-sm rounded bg-ink/10 motion-safe:animate-pulse dark:bg-paper/10" />
    </div>
  );
}
