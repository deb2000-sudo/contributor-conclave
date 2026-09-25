import Link from "next/link";

import { focusRing } from "@/components/ui/styles";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 tabIndex={-1} className={`text-3xl font-semibold tracking-tight ${focusRing}`}>
        Access denied
      </h1>
      <p>Your account does not have permission to view that page.</p>
      <Link className={`w-fit underline underline-offset-4 ${focusRing}`} href="/login">
        Back to log in
      </Link>
    </main>
  );
}
