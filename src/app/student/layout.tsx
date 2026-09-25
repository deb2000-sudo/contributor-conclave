import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { enforcePageRole } from "@/lib/auth/authorization";

const items = [
  { href: "/student", label: "Overview" },
  { href: "/student/activity", label: "GitHub Activity" },
  { href: "/student/repositories", label: "Repositories" },
  { href: "/student/pull-requests", label: "Pull Requests" },
  { href: "/student/submissions", label: "PR Submission" },
  { href: "/student/mentor", label: "Mentor" },
  { href: "/student/chat", label: "Chat" },
  { href: "/student/profile", label: "Profile" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforcePageRole("STUDENT");

  return (
    <WorkspaceShell label="Student" items={items}>
      {children}
    </WorkspaceShell>
  );
}
