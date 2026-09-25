"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function StudentError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main>
      <ErrorState
        title="This page could not be loaded"
        message="The student dashboard ran into a problem. Try again."
        titleLevel="h1"
        onRetry={retry}
      />
    </main>
  );
}
