import { Suspense } from "react";

import { PullRequestPanel } from "@/components/student/pull-request-panel";
import { StudentSection } from "@/components/student/student-section";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { requireStudent } from "@/lib/auth/authorization";
import { getStudentAccount } from "@/lib/student/dashboard";

export const metadata = { title: "Pull Requests" };

export default async function StudentPullRequestsPage() {
  const user = await requireStudent();
  const student = await getStudentAccount(user.id);

  if (!student) {
    return (
      <StudentSection
        crumb="Pull Requests"
        title="Pull Requests"
        description="Pull requests GitHub lists for your username."
      >
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  return (
    <StudentSection
      crumb="Pull Requests"
      title="Pull Requests"
      description="Pull requests GitHub lists for your username."
    >
      <Suspense fallback={<LoadingState label="Loading GitHub pull requests" />}>
        <PullRequestPanel username={student.githubUsername} />
      </Suspense>
    </StudentSection>
  );
}
