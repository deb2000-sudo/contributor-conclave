import Link from "next/link";

import { AccountActiveForm, StudentProfileForm } from "@/components/admin/forms";
import { AdminNote, AdminSection } from "@/components/admin/section";
import { FactList } from "@/components/student/fact-list";
import { TextLink } from "@/components/student/text-link";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { accountLabel } from "@/lib/admin/labels";
import { getStudent } from "@/lib/admin/people";
import { requireAdmin } from "@/lib/auth/authorization";
import { formatTimestamp, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Student" };

export default async function AdminStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const result = await getStudent(admin.id, userId);

  if (!result.ok) {
    return (
      <AdminSection crumb="Student" title="Student" description="Student account.">
        <ErrorState title="Student unavailable" message={result.message} />
      </AdminSection>
    );
  }

  const student = result.data;
  const account = accountLabel(student.deactivatedAt);

  return (
    <AdminSection crumb={student.name} title={student.name} description="Update profile fields or deactivate this student.">
      {query.updated === "1" ? <AdminNote>The student account was updated.</AdminNote> : null}
      <FactList
        facts={[
          { label: "Email", value: student.email },
          { label: "NIAT ID", value: student.niatId },
          { label: "GitHub", value: student.githubUsername ?? "None" },
          { label: "Account", value: <StatusBadge tone={account.tone}>{account.label}</StatusBadge> },
        ]}
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Profile</h2>
        <StudentProfileForm
          userId={student.id}
          firstName={student.firstName}
          lastName={student.lastName}
          batch={student.batch}
          universityName={student.universityName}
        />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{student.deactivatedAt ? "Reactivate" : "Deactivate"}</h2>
        <p className="max-w-xl text-sm text-ink/75 dark:text-paper/75">
          Deactivating signs the student out and stops a new login.
        </p>
        <AccountActiveForm
          userId={student.id}
          active={student.deactivatedAt !== null}
          returnTo={`/admin/students/${student.id}`}
        />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Recent submissions</h2>
        {student.submissionCount > student.recentSubmissions.length ? (
          <p className="text-sm text-ink/70 dark:text-paper/70">
            Showing the {student.recentSubmissions.length} most recent of {student.submissionCount}.
          </p>
        ) : null}
        <DataTable
          caption="Recent submissions"
          emptyTitle="No submissions"
          emptyDescription="Pull requests this student submits appear here."
          columns={[
            { key: "repository", header: "Repository" },
            { key: "status", header: "Status" },
            { key: "submitted", header: "Submitted" },
            { key: "view", header: "View" },
          ]}
          rows={student.recentSubmissions.map((submission) => {
            const status = submissionLabel(submission.status);
            return {
              id: submission.id,
              repository: submission.repository,
              status: <StatusBadge tone={status.tone}>{status.label}</StatusBadge>,
              submitted: formatTimestamp(submission.submittedAt),
              view: (
                <Link href={`/admin/submissions/${submission.id}`} className="underline underline-offset-4">
                  View
                </Link>
              ),
            };
          })}
        />
        {student.recentSubmissions[0] ? (
          <TextLink href={student.recentSubmissions[0].githubPrUrl}>Latest pull request</TextLink>
        ) : null}
      </section>
    </AdminSection>
  );
}
