import { MessageForm } from "@/components/chat/message-form";
import { MessageLog } from "@/components/chat/message-log";
import { StudentSection } from "@/components/student/student-section";
import { StatusNote } from "@/components/ui/status-note";
import { TextLink } from "@/components/student/text-link";
import { ErrorState } from "@/components/ui/error-state";
import { requireStudent } from "@/lib/auth/authorization";
import { messagingService } from "@/lib/messaging/service";

export const metadata = { title: "Conversation" };

export default async function StudentConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ before?: string; sent?: string }>;
}) {
  const student = await requireStudent();
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const before = typeof query.before === "string" ? query.before : null;
  const result = await messagingService.getConversation(student.id, submissionId, before);

  if (!result.ok) {
    return (
      <StudentSection crumb="Chat" title="Conversation" description="Messages on your pull request.">
        <ErrorState title="Conversation unavailable" message={result.message} />
      </StudentSection>
    );
  }

  const thread = result.data;
  const base = `/student/chat/${thread.submissionId}`;

  return (
    <StudentSection
      crumb="Chat"
      title={thread.counterpartName}
      description="Only you and the assigned mentor can read this conversation."
    >
      {query.sent === "1" ? <StatusNote>The message was sent.</StatusNote> : null}
      <p>
        <TextLink href={thread.githubPrUrl}>{thread.repository}</TextLink>
      </p>
      <MessageLog
        messages={thread.messages}
        olderHref={thread.olderCursor ? `${base}?before=${thread.olderCursor}` : null}
        latestHref={before ? base : null}
      />
      <MessageForm submissionId={thread.submissionId} returnTo={base} />
    </StudentSection>
  );
}
