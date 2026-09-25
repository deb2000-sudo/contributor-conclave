import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Sign up" }]} />
      <PageHeader
        title="Sign up"
        description="Choose the account that matches how you will take part in reviews."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-2xl border border-ink/10 p-5 dark:border-paper/15">
          <h2 className="text-xl font-semibold">Student</h2>
          <p className="text-ink/75 dark:text-paper/75">
            Submit GitHub pull requests and work through mentor feedback.
          </p>
          <ButtonLink href="/register/student">Create a student account</ButtonLink>
        </article>
        <article className="flex flex-col gap-4 rounded-2xl border border-ink/10 p-5 dark:border-paper/15">
          <h2 className="text-xl font-semibold">Mentor</h2>
          <p className="text-ink/75 dark:text-paper/75">
            Review student pull requests and keep the conversation next to the diff.
          </p>
          <ButtonLink href="/register/mentor">Create a mentor account</ButtonLink>
        </article>
      </div>
    </main>
  );
}
