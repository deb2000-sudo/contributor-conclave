import { focusRing } from "@/components/ui/styles";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      {eyebrow ? (
        <p className="text-sm font-medium text-moss-700 dark:text-moss-300">{eyebrow}</p>
      ) : null}
      <h1 tabIndex={-1} className={`text-3xl font-semibold tracking-tight ${focusRing}`}>
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-ink/75 dark:text-paper/75">{description}</p>
      ) : null}
    </header>
  );
}
