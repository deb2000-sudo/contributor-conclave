"use client";

import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";

export function RetryRefresh({ title, message }: { title: string; message: string }) {
  const router = useRouter();

  return <ErrorState title={title} message={message} onRetry={() => router.refresh()} />;
}
