"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { focusRing } from "@/components/ui/styles";

export function CurrentLink({
  href,
  children,
  className,
  currentClassName,
  section = false,
}: {
  href: string;
  children: string;
  className: string;
  currentClassName: string;
  section?: boolean;
}) {
  const pathname = usePathname();
  const current = section ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${current ? currentClassName : className} ${focusRing} rounded-md`}
    >
      {children}
    </Link>
  );
}
