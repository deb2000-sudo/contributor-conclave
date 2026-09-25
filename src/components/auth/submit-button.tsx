export function SubmitButton({
  pending,
  pendingLabel = "Please wait…",
  children,
}: {
  pending: boolean;
  pendingLabel?: string;
  children: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:focus-visible:outline-zinc-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
