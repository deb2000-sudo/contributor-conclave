import Link from "next/link";

import { ContributionGrid } from "@/components/shell/contribution-grid";
import { ButtonLink } from "@/components/ui/button-link";
import { focusRing } from "@/components/ui/styles";

const pillars = [
  {
    href: "/mentorship",
    title: "Mentorship",
    text: "Students and mentors meet around real repositories, not isolated assignments.",
  },
  {
    href: "/reviews",
    title: "Pull request review",
    text: "A review is a conversation on the diff: what changed, what to try next, and when it is ready.",
  },
  {
    href: "/collaborate",
    title: "Collaboration",
    text: "Messages stay next to the pull request so the thread and the code remain one piece of work.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex flex-col gap-6">
          <h1 tabIndex={-1} className={`max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl ${focusRing}`}>
            Contributor Conclave
          </h1>
          <p className="max-w-xl text-lg text-ink/75 dark:text-paper/75">
            A place to practice GitHub contributions with a mentor beside the pull request.
            Open a change, ask for review, and learn from the comments.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup">Sign up</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Log in
            </ButtonLink>
          </div>
        </div>
        <ContributionGrid />
      </section>
      <section className="border-t border-ink/10 dark:border-paper/10">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.href} className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{pillar.title}</h2>
              <p className="text-ink/75 dark:text-paper/75">{pillar.text}</p>
              <Link
                href={pillar.href}
                className={`w-fit text-sm font-medium text-moss-700 underline underline-offset-4 dark:text-moss-300 ${focusRing}`}
              >
                Read about {pillar.title.toLowerCase()}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
