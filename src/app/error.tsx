"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <ErrorState titleLevel="h1" onRetry={reset} />
    </main>
  );
}
