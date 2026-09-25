import { MentorSection } from "@/components/mentor/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { listMentorTechStacks } from "@/lib/mentor/directory";

export const metadata = { title: "Tech stack" };

export default async function MentorTechStackPage() {
  const mentor = await requireMentor();
  const result = await listMentorTechStacks(mentor.id);

  if (!result.ok) {
    return (
      <MentorSection crumb="Tech stack" title="Tech stack" description="Stacks an administrator linked to your account.">
        <ErrorState title="Tech stack unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const truncated = result.data.some((stack) => stack.truncated);

  return (
    <MentorSection crumb="Tech stack" title="Tech stack" description="Stacks an administrator linked to your account.">
      {result.data.length === 0 ? (
        <EmptyState
          title="No tech stacks"
          description="An administrator links the stacks you can be assigned to review."
        />
      ) : (
        <>
          {truncated ? (
            <p className="text-sm text-ink/70 dark:text-paper/70">Showing the first 100 tech stacks.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {result.data.map((stack) => (
              <li key={stack.id} className="border-t border-ink/10 py-3 dark:border-paper/10">
                {stack.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </MentorSection>
  );
}
