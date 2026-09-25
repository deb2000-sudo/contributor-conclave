import { focusRing } from "@/components/ui/styles";
import type { AuthorProfile } from "@/lib/site/author";

const description = "Mentorship around GitHub contributions and pull-request review.";

function ProfileLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-sm underline underline-offset-4 ${focusRing}`}
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function SiteFooter({ author }: { author: AuthorProfile }) {
  const links = [
    author.githubUrl ? { href: author.githubUrl, label: "GitHub profile" } : null,
    author.linkedinUrl ? { href: author.linkedinUrl, label: "LinkedIn profile" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <footer className="mt-auto border-t border-ink/10 dark:border-paper/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <p className="font-semibold tracking-tight">Contributor Conclave</p>
          <p className="mt-1 text-sm text-ink/75 dark:text-paper/75">{description}</p>
        </div>
        {author.name || links.length > 0 ? (
          <div className="text-sm">
            {author.name ? <p>Author: {author.name}</p> : null}
            {links.length > 0 ? (
              <nav aria-label="Author profiles" className="mt-2">
                <ul className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  {links.map((link) => (
                    <li key={link.label}>
                      <ProfileLink href={link.href} label={link.label} />
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
