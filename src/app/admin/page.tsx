import Link from "next/link";

import { AdminSection } from "@/components/admin/section";
import { ErrorState } from "@/components/ui/error-state";
import { overview } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Overview" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const result = await overview(admin.id);

  if (!result.ok) {
    return (
      <AdminSection title="Overview" description="The contributor-conclave workflow.">
        <ErrorState title="Overview unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const cards = [
    { href: "/admin/students", label: "Active students", value: result.data.activeStudents },
    { href: "/admin/mentors", label: "Active mentors", value: result.data.activeMentors },
    { href: "/admin/approvals", label: "Mentor approvals", value: result.data.pendingApprovals },
    { href: "/admin/submissions?status=PENDING", label: "Pending submissions", value: result.data.pendingSubmissions },
    { href: "/admin/assignments", label: "Active assignments", value: result.data.activeAssignments },
  ];

  return (
    <AdminSection
      title={`Hello, ${admin.firstName}`}
      description="Review students, mentors, pull requests, and assignments."
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block rounded-2xl border border-ink/10 px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-700 dark:border-paper/10 dark:focus-visible:outline-moss-300"
            >
              <p className="text-sm text-ink/70 dark:text-paper/70">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}
