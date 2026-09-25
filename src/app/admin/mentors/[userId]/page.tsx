import { AccountActiveForm, MentorDecisionForm, MentorProfileForm } from "@/components/admin/forms";
import { AdminNote, AdminSection } from "@/components/admin/section";
import { FactList } from "@/components/student/fact-list";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { accountLabel, approvalLabel } from "@/lib/admin/labels";
import { getMentor } from "@/lib/admin/people";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata = { title: "Mentor" };

export default async function AdminMentorPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const result = await getMentor(admin.id, userId);

  if (!result.ok) {
    return (
      <AdminSection crumb="Mentor" title="Mentor" description="Mentor account.">
        <ErrorState title="Mentor unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const mentor = result.data;
  const approval = approvalLabel(mentor.approvalStatus);
  const account = accountLabel(mentor.deactivatedAt);

  return (
    <AdminSection crumb={mentor.name} title={mentor.name} description="Approve this mentor and choose the tech stacks they can review.">
      {query.updated === "1" ? <AdminNote>The mentor account was updated.</AdminNote> : null}
      <FactList
        facts={[
          { label: "Email", value: mentor.email },
          { label: "Employee ID", value: mentor.employeeId },
          { label: "GitHub", value: mentor.githubUsername ?? "None" },
          { label: "Approval", value: <StatusBadge tone={approval.tone}>{approval.label}</StatusBadge> },
          { label: "Account", value: <StatusBadge tone={account.tone}>{account.label}</StatusBadge> },
        ]}
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Approval</h2>
        <MentorDecisionForm userId={mentor.id} returnTo={`/admin/mentors/${mentor.id}`} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Profile</h2>
        <MentorProfileForm
          userId={mentor.id}
          firstName={mentor.firstName}
          lastName={mentor.lastName}
          batch={mentor.batch}
          universityName={mentor.universityName}
          techStacks={mentor.techStacks}
          techStackIds={mentor.techStackIds}
        />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{mentor.deactivatedAt ? "Reactivate" : "Deactivate"}</h2>
        <p className="max-w-xl text-sm text-ink/75 dark:text-paper/75">
          A deactivated mentor cannot sign in and cannot be assigned to a pull request.
        </p>
        <AccountActiveForm
          userId={mentor.id}
          active={mentor.deactivatedAt !== null}
          returnTo={`/admin/mentors/${mentor.id}`}
        />
      </section>
    </AdminSection>
  );
}
