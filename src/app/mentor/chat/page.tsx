import { Pager } from "@/components/admin/pager";
import { ConversationList } from "@/components/chat/message-log";
import { MentorSection } from "@/components/mentor/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { messagingService } from "@/lib/messaging/service";
import { readPage } from "@/lib/mentor/query";

export const metadata = { title: "Chat" };

export default async function MentorChatPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const mentor = await requireMentor();
  const params = await searchParams;
  const result = await messagingService.listConversations(mentor.id, readPage(params.page));

  if (!result.ok) {
    return (
      <MentorSection crumb="Chat" title="Chat" description="Messages with students on pull requests assigned to you.">
        <ErrorState title="Chat unavailable" message={result.message} />
      </MentorSection>
    );
  }

  return (
    <MentorSection crumb="Chat" title="Chat" description="Messages with students on pull requests assigned to you.">
      {result.data.items.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="A conversation opens when a pull request is assigned to you."
        />
      ) : (
        <ConversationList items={result.data.items} hrefFor={(submissionId) => `/mentor/chat/${submissionId}`} />
      )}
      <Pager
        page={result.data.page}
        total={result.data.total}
        pageSize={result.data.pageSize}
        href={(page) => (page > 1 ? `/mentor/chat?page=${page}` : "/mentor/chat")}
      />
    </MentorSection>
  );
}
