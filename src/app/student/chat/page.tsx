import { Pager } from "@/components/admin/pager";
import { ConversationList } from "@/components/chat/message-log";
import { StudentSection } from "@/components/student/student-section";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { requireStudent } from "@/lib/auth/authorization";
import { messagingService } from "@/lib/messaging/service";
import { readPage } from "@/lib/mentor/query";

export const metadata = { title: "Chat" };

export default async function StudentChatPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const student = await requireStudent();
  const params = await searchParams;
  const result = await messagingService.listConversations(student.id, readPage(params.page));

  if (!result.ok) {
    return (
      <StudentSection crumb="Chat" title="Chat" description="Messages with the mentor assigned to your pull request.">
        <ErrorState title="Chat unavailable" message={result.message} />
      </StudentSection>
    );
  }

  return (
    <StudentSection crumb="Chat" title="Chat" description="Messages with the mentor assigned to your pull request.">
      {result.data.items.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="A conversation opens when a mentor is assigned to your pull request."
        />
      ) : (
        <ConversationList items={result.data.items} hrefFor={(submissionId) => `/student/chat/${submissionId}`} />
      )}
      <Pager
        page={result.data.page}
        total={result.data.total}
        pageSize={result.data.pageSize}
        href={(page) => (page > 1 ? `/student/chat?page=${page}` : "/student/chat")}
      />
    </StudentSection>
  );
}
