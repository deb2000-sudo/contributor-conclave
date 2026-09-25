import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { enforcePageRole } from "@/lib/auth/authorization";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/students", label: "Students", section: true },
  { href: "/admin/mentors", label: "Mentors", section: true },
  { href: "/admin/submissions", label: "PR Submissions", section: true },
  { href: "/admin/assignments", label: "Assignments", section: true },
  { href: "/admin/tech-stacks", label: "Tech Stacks", section: true },
  { href: "/admin/approvals", label: "Mentor Approvals", section: true },
  { href: "/admin/audit", label: "Audit Logs", section: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforcePageRole("ADMIN");

  return (
    <WorkspaceShell label="Administrator workspace" items={items}>
      {children}
    </WorkspaceShell>
  );
}
