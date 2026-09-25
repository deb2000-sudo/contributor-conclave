const tones = {
  neutral: "bg-ink/8 text-ink dark:bg-paper/10 dark:text-paper",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100",
  approved: "bg-moss-100 text-moss-900 dark:bg-moss-900 dark:text-moss-100",
  changes: "bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100",
  closed: "bg-ink/10 text-ink dark:bg-paper/15 dark:text-paper",
} as const;

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
