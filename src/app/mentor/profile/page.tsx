import { FactList } from "@/components/student/fact-list";
import { TextLink } from "@/components/student/text-link";
import { MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { approvalLabel } from "@/lib/admin/labels";
import { requireMentor } from "@/lib/auth/authorization";
import { normalizeGitHubUsername } from "@/lib/github/parse";
import { getMentorProfile } from "@/lib/mentor/directory";

export const metadata = { title: "Profile" };

export default async function MentorProfilePage() {
  const mentor = await requireMentor();
  const result = await getMentorProfile(mentor.id);

  if (!result.ok) {
    return (
      <MentorSection crumb="Profile" title="Profile" description="The details saved on your mentor account.">
        <ErrorState title="Profile unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const profile = result.data;
  const login = profile.githubUsername ? normalizeGitHubUsername(profile.githubUsername) : null;
  const approval = approvalLabel(profile.approvalStatus);

  return (
    <MentorSection crumb="Profile" title="Profile" description="The details saved on your mentor account.">
      <FactList
        facts={[
          { label: "Name", value: `${profile.firstName} ${profile.lastName}` },
          { label: "Email", value: profile.email },
          { label: "Employee ID", value: profile.employeeId },
          { label: "University", value: profile.universityName },
          { label: "Batch", value: profile.batch },
          {
            label: "Approval",
            value: <StatusBadge tone={approval.tone}>{approval.label}</StatusBadge>,
          },
          {
            label: "GitHub username",
            value: login ? <TextLink href={`https://github.com/${login}`}>{login}</TextLink> : "None saved",
          },
        ]}
      />
    </MentorSection>
  );
}
