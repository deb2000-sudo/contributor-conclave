import Link from "next/link";

import { focusRing } from "@/components/ui/styles";

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: string;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-paper dark:bg-paper dark:text-ink"
      : "border border-ink/20 dark:border-paper/25";

  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ${styles} ${focusRing}`}
    >
      {children}
    </Link>
  );
}
