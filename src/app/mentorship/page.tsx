import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

export default function MentorshipPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Mentorship" }]} />
      <PageHeader
        eyebrow="Mentorship"
        title="A mentor for the contribution, not a lecture"
        description="Students bring a repository and a pull request. Mentors answer in the context of that change, so the advice stays attached to the code."
      />
      <ul className="list-disc space-y-2 pl-5 text-ink/80 dark:text-paper/80">
        <li>Students register with a NIAT ID and a GitHub username.</li>
        <li>Mentors register with an employee ID and a NxtWave email.</li>
        <li>Administrators connect a mentor to a submission when a review should begin.</li>
      </ul>
    </main>
  );
}
