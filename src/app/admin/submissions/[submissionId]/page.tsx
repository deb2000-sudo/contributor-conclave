import Link from "next/link";

import { AssignMentorForm } from "@/components/admin/forms";
import { AdminNote, AdminSection } from "@/components/admin/section";
import { TextLink } from "@/components/student/text-link";
import { FactList } from "@/components/student/fact-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getSubmission } from "@/lib/admin/workflow";
import { requireAdmin } from "@/lib/auth/authorization";
import { formatTimestamp, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Submission" };

export default async function AdminSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const result = await getSubmission(admin.id, submissionId);

  if (!result.ok) {
    return (
      <AdminSection crumb="Submission" title="Submission" description="Pull request submission.">
        <ErrorState title="Submission unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const submission = result.data;
  const status = submissionLabel(submission.status);

  return (
    <AdminSection
      crumb={submission.repository}
      title={submission.repository}
      description="Assign an approved mentor who covers this tech stack."
    >
      {query.updated === "1" ? <AdminNote>The mentor assignment was saved.</AdminNote> : null}
      <FactList
        facts={[
          {
            label: "Student",
            value: (
              <Link href={`/admin/students/${submission.studentId}`} className="underline underline-offset-4">
                {submission.studentName}
              </Link>
            ),
          },
          { label: "Repository", value: submission.repository },
          { label: "Pull request", value: <TextLink href={submission.githubPrUrl}>Open pull request</TextLink> },
          { label: "Tech stack", value: submission.techStack },
          { label: "Status", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
          { label: "Submitted", value: formatTimestamp(submission.submittedAt) },
          { label: "Current mentor", value: submission.activeMentor?.name ?? "Unassigned" },
        ]}
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{submission.activeMentor ? "Reassign mentor" : "Assign mentor"}</h2>
        {submission.status === "CLOSED" ? (
          <EmptyState title="Submission is closed" description="Closed submissions cannot be assigned." />
        ) : submission.eligibleMentors.length === 0 ? (
          <EmptyState
            title="No mentor available"
            description={`Approve an active mentor and link them to ${submission.techStack} before assigning this pull request.`}
          />
        ) : (
          <AssignMentorForm submissionId={submission.id} mentors={submission.eligibleMentors} />
        )}
      </section>
    </AdminSection>
  );
}
