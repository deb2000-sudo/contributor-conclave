import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

export default function CollaboratePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Collaborate" }]} />
      <PageHeader
        eyebrow="Collaboration"
        title="One thread for each pull request"
        description="Students, mentors, and administrators share a conversation that belongs to the submission. Messages stay with the review instead of scattering across inboxes."
      />
      <ol className="list-decimal space-y-3 pl-5 text-ink/80 dark:text-paper/80">
        <li>A student opens a pull request and records it here.</li>
        <li>An administrator assigns a mentor.</li>
        <li>The mentor and student talk through the diff until the review is settled.</li>
      </ol>
    </main>
  );
}
