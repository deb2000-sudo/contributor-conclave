import Link from "next/link";

import { Disclosure } from "@/components/shell/disclosure";
import { NotificationArea } from "@/components/shell/notification-area";
import { PrimaryLinks } from "@/components/shell/primary-links";
import { UserMenu } from "@/components/shell/user-menu";
import { ButtonLink } from "@/components/ui/button-link";
import { focusRing } from "@/components/ui/styles";
import { homeForRole } from "@/lib/auth/authorization";
import type { PublicUser } from "@/lib/auth/types";

export function Navbar({ user }: { user: PublicUser | null }) {
  return (
    <header className="border-b border-ink/10 bg-paper/90 dark:border-paper/10 dark:bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className={`flex items-center gap-2 font-semibold tracking-tight ${focusRing} rounded-md`}>
          <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
            <span className="size-2 rounded-[2px] bg-moss-500" />
            <span className="size-2 rounded-[2px] bg-moss-700" />
            <span className="size-2 rounded-[2px] bg-moss-500" />
            <span className="size-2 rounded-[2px] bg-moss-900" />
          </span>
          Contributor Conclave
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            <PrimaryLinks className="text-ink/80 dark:text-paper/80" />
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Disclosure
            className="relative md:hidden"
            summaryClassName={`cursor-pointer rounded-full border border-ink/15 px-3 py-2 text-sm dark:border-paper/20 ${focusRing}`}
            summary="Menu"
          >
            <nav
              aria-label="Menu"
              className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-ink/15 bg-paper p-3 dark:border-paper/15 dark:bg-ink"
            >
              <ul className="flex flex-col gap-2">
                <PrimaryLinks className="text-ink dark:text-paper" />
              </ul>
            </nav>
          </Disclosure>
          {user ? (
            <>
              <ButtonLink href={homeForRole(user.role)} variant="secondary">
                Workspace
              </ButtonLink>
              <NotificationArea />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="secondary">
                Log in
              </ButtonLink>
              <ButtonLink href="/signup">Sign up</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
