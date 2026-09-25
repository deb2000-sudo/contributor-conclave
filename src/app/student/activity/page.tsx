import { Suspense } from "react";

import { GitHubInsights } from "@/components/student/github-insights";
import { StudentSection } from "@/components/student/student-section";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { requireStudent } from "@/lib/auth/authorization";
import { getStudentAccount } from "@/lib/student/dashboard";

export const metadata = { title: "GitHub Activity" };

export default async function StudentActivityPage() {
  const user = await requireStudent();
  const student = await getStudentAccount(user.id);

  if (!student) {
    return (
      <StudentSection
        crumb="GitHub Activity"
        title="GitHub Activity"
        description="GitHub insights for the account linked to you."
      >
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  return (
    <StudentSection
      crumb="GitHub Activity"
      title="GitHub Activity"
      description="Profile, contributions, repositories, and pull requests from your GitHub account."
    >
      <Suspense fallback={<LoadingState label="Loading GitHub insights" />}>
        <GitHubInsights username={student.githubUsername} />
      </Suspense>
    </StudentSection>
  );
}
