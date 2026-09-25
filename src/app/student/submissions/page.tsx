import { Suspense } from "react";

import { Pager } from "@/components/admin/pager";
import { StudentSection } from "@/components/student/student-section";
import { SubmissionForm } from "@/components/student/submission-form";
import { SubmissionTable } from "@/components/student/submission-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusNote } from "@/components/ui/status-note";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { requireStudent } from "@/lib/auth/authorization";
import { getStudentAccount, listStudentSubmissions } from "@/lib/student/dashboard";
import { readPage } from "@/lib/mentor/query";
import { listTechStacks } from "@/lib/student/submissions";

export const metadata = { title: "PR Submission" };

export default async function StudentSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string | string[]; page?: string | string[] }>;
}) {
  const user = await requireStudent();
  const params = await searchParams;
  const [student, stacks] = await Promise.all([getStudentAccount(user.id), listTechStacks()]);

  if (!student) {
    return (
      <StudentSection
        crumb="PR Submission"
        title="PR Submission"
        description="Pull requests submitted for mentorship."
      >
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  const submitted = params.submitted === "1";

  return (
    <StudentSection
      crumb="PR Submission"
      title="PR Submission"
      description="Choose a tech stack, enter a GitHub pull request you opened, and send it to the admin queue."
    >
      {submitted ? <StatusNote>The pull request is in the admin queue with status Pending.</StatusNote> : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Submit a pull request</h2>
        {student.githubUsername ? (
          stacks.length > 0 ? (
            <SubmissionForm stacks={stacks} />
          ) : (
            <EmptyState
              title="No tech stacks available"
              description="A tech stack has to exist before a pull request can be submitted."
            />
          )
        ) : (
          <ErrorState
            title="GitHub username required"
            message="This account has no linked GitHub username, so a pull request cannot be checked."
          />
        )}
      </section>

      <Suspense fallback={<LoadingState label="Loading submissions" />}>
        <SubmissionList userId={user.id} page={readPage(params.page)} />
      </Suspense>
    </StudentSection>
  );
}

async function SubmissionList({ userId, page }: { userId: string; page: number }) {
  const list = await listStudentSubmissions(userId, page);
  if (!list) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Your submissions</h2>
      <SubmissionTable submissions={list.submissions} caption="Submitted pull requests" />
      <Pager
        page={list.page}
        total={list.total}
        pageSize={list.pageSize}
        href={(nextPage) => (nextPage > 1 ? `/student/submissions?page=${nextPage}` : "/student/submissions")}
      />
    </section>
  );
}
