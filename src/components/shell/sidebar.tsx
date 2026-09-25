import { CurrentLink } from "@/components/shell/current-link";

export function Sidebar({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; section?: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="border-b border-ink/10 lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0 dark:border-paper/10"
    >
      <ul className="flex gap-2 overflow-x-auto px-4 py-3 lg:flex-col lg:px-4 lg:py-8">
        {items.map((item) => (
          <li key={item.href}>
            <CurrentLink
              href={item.href}
              section={item.section}
              className="whitespace-nowrap px-3 py-2 text-sm text-ink/80 dark:text-paper/80"
              currentClassName="whitespace-nowrap bg-moss-100 px-3 py-2 text-sm font-medium text-moss-900 underline decoration-moss-900 underline-offset-4 dark:bg-moss-900 dark:text-moss-100 dark:decoration-moss-100"
            >
              {item.label}
            </CurrentLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
