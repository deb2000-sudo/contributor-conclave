import { MessageForm } from "@/components/chat/message-form";
import { MessageLog } from "@/components/chat/message-log";
import { MentorNote, MentorSection } from "@/components/mentor/section";
import { TextLink } from "@/components/student/text-link";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { messagingService } from "@/lib/messaging/service";

export const metadata = { title: "Conversation" };

export default async function MentorConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ before?: string; sent?: string }>;
}) {
  const mentor = await requireMentor();
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const before = typeof query.before === "string" ? query.before : null;
  const result = await messagingService.getConversation(mentor.id, submissionId, before);

  if (!result.ok) {
    return (
      <MentorSection crumb="Chat" title="Conversation" description="Messages on an assigned pull request.">
        <ErrorState title="Conversation unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const thread = result.data;
  const base = `/mentor/chat/${thread.submissionId}`;

  return (
    <MentorSection
      crumb="Chat"
      title={thread.counterpartName}
      description="Only you and the assigned student can read this conversation."
    >
      {query.sent === "1" ? <MentorNote>The message was sent.</MentorNote> : null}
      <p>
        <TextLink href={thread.githubPrUrl}>{thread.repository}</TextLink>
      </p>
      <MessageLog
        messages={thread.messages}
        olderHref={thread.olderCursor ? `${base}?before=${thread.olderCursor}` : null}
        latestHref={before ? base : null}
      />
      <MessageForm submissionId={thread.submissionId} returnTo={base} />
    </MentorSection>
  );
}
