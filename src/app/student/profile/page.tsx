import { FactList } from "@/components/student/fact-list";
import { StudentSection } from "@/components/student/student-section";
import { TextLink } from "@/components/student/text-link";
import { ErrorState } from "@/components/ui/error-state";
import { requireStudent } from "@/lib/auth/authorization";
import { normalizeGitHubUsername } from "@/lib/github/parse";
import { getStudentAccount } from "@/lib/student/dashboard";

export const metadata = { title: "Profile" };

export default async function StudentProfilePage() {
  const user = await requireStudent();
  const student = await getStudentAccount(user.id);

  if (!student) {
    return (
      <StudentSection crumb="Profile" title="Profile" description="The details saved on your student account.">
        <ErrorState title="Student profile missing" message="This account has no student profile." />
      </StudentSection>
    );
  }

  const login = student.githubUsername ? normalizeGitHubUsername(student.githubUsername) : null;

  return (
    <StudentSection
      crumb="Profile"
      title="Profile"
      description="The details saved on your student account."
    >
      <FactList
        facts={[
          { label: "Name", value: `${student.firstName} ${student.lastName}` },
          { label: "Email", value: student.email },
          { label: "NIAT ID", value: student.niatId },
          { label: "University", value: student.universityName },
          { label: "Batch", value: student.batch },
          {
            label: "GitHub username",
            value: login ? (
              <TextLink href={`https://github.com/${login}`}>{login}</TextLink>
            ) : (
              "None saved"
            ),
          },
        ]}
      />
    </StudentSection>
  );
}
