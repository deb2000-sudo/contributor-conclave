import { focusRing } from "@/components/ui/styles";
import { httpsUrl } from "@/lib/github/parse";

export function TextLink({ href, children }: { href: string; children: string }) {
  const safeHref = httpsUrl(href);
  if (!safeHref) {
    return <span className="break-words">{children}</span>;
  }

  return (
    <a
      href={safeHref}
      className={`rounded-sm break-words underline underline-offset-4 ${focusRing}`}
    >
      {children}
    </a>
  );
}
