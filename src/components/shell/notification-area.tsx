import { Disclosure } from "@/components/shell/disclosure";
import { focusRing } from "@/components/ui/styles";

export function NotificationArea() {
  return (
    <Disclosure
      className="relative"
      summaryClassName={`cursor-pointer list-none rounded-full border border-ink/15 px-3 py-2 text-sm font-medium dark:border-paper/20 ${focusRing}`}
      summary="Notifications"
    >
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-ink/15 bg-paper p-4 text-sm shadow-sm dark:border-paper/15 dark:bg-ink">
        <p className="font-medium">No notifications</p>
        <p className="mt-1 text-ink/70 dark:text-paper/70">
          Review requests and messages will appear here.
        </p>
      </div>
    </Disclosure>
  );
}
