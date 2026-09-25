import { CurrentLink } from "@/components/shell/current-link";

export const primaryLinks = [
  { href: "/mentorship", label: "Mentorship" },
  { href: "/reviews", label: "Reviews" },
  { href: "/collaborate", label: "Collaborate" },
] as const;

export function PrimaryLinks({ className }: { className: string }) {
  return (
    <>
      {primaryLinks.map((link) => (
        <li key={link.href}>
          <CurrentLink
            href={link.href}
            className={`px-2 py-1 text-sm ${className}`}
            currentClassName="px-2 py-1 text-sm font-semibold text-moss-700 underline decoration-moss-700 underline-offset-4 dark:text-moss-300 dark:decoration-moss-300"
          >
            {link.label}
          </CurrentLink>
        </li>
      ))}
    </>
  );
}
