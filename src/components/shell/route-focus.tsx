"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { focusRing } from "@/components/ui/styles";

export function RouteFocus() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = `${pathname}?${searchParams.toString()}`;
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const root = document.getElementById("content");
    const target =
      root?.querySelector<HTMLElement>("[data-route-status]") ??
      root?.querySelector<HTMLElement>("h1");
    if (!target) {
      return;
    }

    target.tabIndex = -1;
    if (!target.className.includes("focus-visible:outline")) {
      target.className = `${target.className} ${focusRing}`.trim();
    }
    target.focus();
  }, [location]);

  return null;
}
