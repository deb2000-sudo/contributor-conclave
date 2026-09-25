import { logoutAction } from "@/app/actions/auth";
import { Disclosure } from "@/components/shell/disclosure";
import { focusRing } from "@/components/ui/styles";
import type { PublicUser } from "@/lib/auth/types";

const roleLabel = {
  STUDENT: "Student",
  MENTOR: "Mentor",
  ADMIN: "Administrator",
} as const;

export function UserMenu({ user }: { user: PublicUser }) {
  return (
    <Disclosure
      className="relative"
      summaryClassName={`cursor-pointer list-none rounded-full border border-ink/15 px-3 py-2 text-sm font-medium dark:border-paper/20 ${focusRing}`}
      summary={
        <>
          {user.firstName}
          <span className="sr-only"> account menu</span>
        </>
      }
    >
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-ink/15 bg-paper p-3 text-sm shadow-sm dark:border-paper/15 dark:bg-ink">
        <p className="font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="mt-1 text-ink/70 dark:text-paper/70">{user.email}</p>
        <p className="mt-1 text-ink/70 dark:text-paper/70">{roleLabel[user.role]}</p>
        <form action={logoutAction} className="mt-3">
          <button type="submit" className={`rounded-sm text-sm font-medium underline underline-offset-4 ${focusRing}`}>
            Log out
          </button>
        </form>
      </div>
    </Disclosure>
  );
}
