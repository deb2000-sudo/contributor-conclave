import { z } from "zod";

import { MentorApprovalStatus, PRSubmissionStatus } from "@/generated/prisma/client";

export const ADMIN_PAGE_SIZE = 20;

export type AdminPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export function readText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, 80);
}

export function readPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    return 1;
  }
  return page;
}

export function clampPage(requested: number, total: number): number {
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  return Math.min(requested, pages);
}

export function readAccount(value: string | string[] | undefined): "all" | "active" | "deactivated" {
  const raw = readText(value);
  if (raw === "active" || raw === "deactivated") {
    return raw;
  }
  return "all";
}

export function readApproval(value: string | string[] | undefined): MentorApprovalStatus | "all" {
  const raw = readText(value);
  if (raw in MentorApprovalStatus) {
    return raw as MentorApprovalStatus;
  }
  return "all";
}

export function readSubmissionStatus(value: string | string[] | undefined): PRSubmissionStatus | "all" {
  const raw = readText(value);
  if (raw in PRSubmissionStatus) {
    return raw as PRSubmissionStatus;
  }
  return "all";
}

export function readOptionalUuid(value: string | string[] | undefined): string | null {
  const raw = readText(value);
  if (!raw) {
    return null;
  }
  return z.uuid().safeParse(raw).success ? raw : null;
}

export function pageQuery(page: number, params: Record<string, string | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  if (page > 1) {
    search.set("page", String(page));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
