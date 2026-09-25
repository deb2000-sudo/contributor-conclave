import { Suspense } from "react";

import { RepositoryPanel } from "@/components/student/repository-panel";
import { StudentSection } from "@/components/student/student-section";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { requireStudent } from "@/lib/auth/authorization";
import { getStudentAccount } from "@/lib/student/dashboard";

export const metadata = { title: "Repositories" };

export default async function StudentRepositoriesPage() {
  const user = await requireStudent();
  const student = await getStudentAccount(user.id);

  if (!student) {
    return (
      <StudentSection
        crumb="Repositories"
        title="Repositories"
        description="Public repositories on your linked GitHub account."
      >
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  return (
    <StudentSection
      crumb="Repositories"
      title="Repositories"
      description="Public repositories on the GitHub account linked to you."
    >
      <Suspense fallback={<LoadingState label="Loading GitHub repositories" />}>
        <RepositoryPanel username={student.githubUsername} />
      </Suspense>
    </StudentSection>
  );
}
