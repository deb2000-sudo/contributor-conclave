import Link from "next/link";

import type { ChatMessage, ConversationSummary } from "@/lib/messaging/service";
import { formatTimestamp } from "@/lib/student/labels";
import { focusRing } from "@/components/ui/styles";

export function ConversationList({
  items,
  hrefFor,
}: {
  items: ConversationSummary[];
  hrefFor: (submissionId: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.submissionId}>
          <Link
            href={hrefFor(item.submissionId)}
            className={`block rounded-2xl border border-ink/10 px-4 py-3 dark:border-paper/10 ${focusRing}`}
          >
            <span className="font-medium">{item.counterpartName}</span>
            <span className="mt-1 block text-sm text-ink/70 dark:text-paper/70">{item.repository}</span>
            <span className="mt-2 block break-words">
              {item.latestText ?? "No messages yet"}
            </span>
            <span className="mt-1 block text-sm text-ink/70 dark:text-paper/70">
              {item.latestAt ? (
                <time dateTime={item.latestAt.toISOString()}>{formatTimestamp(item.latestAt)}</time>
              ) : (
                "Not started"
              )}
              {" · "}
              {item.unreadCount > 0 ? `${item.unreadCount} unread` : "No unread messages"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MessageLog({
  messages,
  olderHref,
  latestHref,
}: {
  messages: ChatMessage[];
  olderHref: string | null;
  latestHref: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {olderHref ? (
        <Link href={olderHref} className={`text-sm underline underline-offset-4 ${focusRing}`}>
          Older messages
        </Link>
      ) : null}
      {messages.length === 0 ? (
        <p className="text-ink/75 dark:text-paper/75">No messages yet. Write the first message below.</p>
      ) : (
        <ol aria-label="Messages" className="flex flex-col gap-3">
          {messages.map((message) => {
            const authorId = `message-${message.id}-author`;
            return (
              <li key={message.id}>
                <article aria-labelledby={authorId} className="border-t border-ink/10 pt-3 dark:border-paper/10">
                  <header className="text-sm text-ink/70 dark:text-paper/70">
                    <p id={authorId}>
                      {message.senderName}
                      {message.own ? " (you)" : ""}
                    </p>
                    <p>
                      <time dateTime={message.createdAt.toISOString()}>{formatTimestamp(message.createdAt)}</time>
                      {message.own ? ` · ${message.status === "READ" ? "Read" : "Sent"}` : null}
                    </p>
                  </header>
                  <p className="mt-1 break-words whitespace-pre-wrap">{message.text}</p>
                </article>
              </li>
            );
          })}
        </ol>
      )}
      {latestHref ? (
        <Link href={latestHref} className={`text-sm underline underline-offset-4 ${focusRing}`}>
          Latest messages
        </Link>
      ) : null}
    </div>
  );
}
