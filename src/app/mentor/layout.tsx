import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { enforcePageRole } from "@/lib/auth/authorization";

const items = [
  { href: "/mentor", label: "Overview" },
  { href: "/mentor/students", label: "Assigned Students", section: true },
  { href: "/mentor/pull-requests", label: "Assigned PRs", section: true },
  { href: "/mentor/reviews", label: "Pending Reviews", section: true },
  { href: "/mentor/history", label: "Review History", section: true },
  { href: "/mentor/tech-stack", label: "Tech Stack", section: true },
  { href: "/mentor/chat", label: "Chat", section: true },
  { href: "/mentor/profile", label: "Profile", section: true },
];

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforcePageRole("MENTOR");

  return (
    <WorkspaceShell label="Mentor workspace" items={items}>
      {children}
    </WorkspaceShell>
  );
}
