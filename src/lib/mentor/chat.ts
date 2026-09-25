import {
  mentorInvalid,
  requireMentorActor,
  type MentorError,
  type MentorSuccess,
} from "@/lib/mentor/access";
import { MENTOR_PAGE_SIZE, paged, type MentorPage } from "@/lib/mentor/query";
import type { MentorChatMessage } from "@/lib/mentor/reviews";
import { db } from "@/lib/db";
import { openStoredMessage } from "@/lib/messaging/crypto";
import { messagingService } from "@/lib/messaging/service";

export type MentorChatThread = {
  submissionId: string;
  studentUserId: string;
  studentName: string;
  repository: string;
  githubPrUrl: string;
  truncated: boolean;
  messages: MentorChatMessage[];
};

const MESSAGE_WINDOW = 30;

function readableBody(protection: "SERVER" | "E2EE", stored: string): string {
  return openStoredMessage(protection, stored).text ?? "This message is protected and cannot be shown here.";
}

export async function listChats(
  actorId: string,
  input: { page: number },
): Promise<MentorSuccess<MentorPage<MentorChatThread>> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const where = { mentorId: actor.data.mentorId, status: "ACTIVE" as const };
  const total = await db.mentorAssignment.count({ where });
  const page = await paged(input.page, total, (skip) =>
    db.mentorAssignment.findMany({
      where,
      orderBy: { prSubmission: { submittedAt: "desc" } },
      skip,
      take: MENTOR_PAGE_SIZE,
      select: {
        prSubmission: {
          select: {
            id: true,
            repository: true,
            githubPrUrl: true,
            student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
            conversation: {
              select: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: MESSAGE_WINDOW + 1,
                    select: {
                      id: true,
                      body: true,
                      protection: true,
                      createdAt: true,
                      sender: { select: { firstName: true, lastName: true } },
                    },
                },
              },
            },
          },
        },
      },
    }),
  );

  return {
    ok: true,
    data: {
      ...page,
      items: page.items.map((row) => {
        const messages = row.prSubmission.conversation?.messages ?? [];
        const truncated = messages.length > MESSAGE_WINDOW;
        const visible = (truncated ? messages.slice(0, MESSAGE_WINDOW) : messages).slice().reverse();
        return {
          submissionId: row.prSubmission.id,
          studentUserId: row.prSubmission.student.userId,
          studentName: `${row.prSubmission.student.user.firstName} ${row.prSubmission.student.user.lastName}`,
          repository: row.prSubmission.repository,
          githubPrUrl: row.prSubmission.githubPrUrl,
          truncated,
          messages: visible.map((message) => ({
            id: message.id,
            body: readableBody(message.protection, message.body),
            createdAt: message.createdAt,
            senderName: `${message.sender.firstName} ${message.sender.lastName}`,
          })),
        };
      }),
    },
  };
}

export async function sendMessage(
  actorId: string,
  submissionId: string,
  input: unknown,
): Promise<MentorSuccess<{ submissionId: string }> | MentorError> {
  const actor = await requireMentorActor(actorId);
  if (!actor.ok) {
    return actor;
  }

  const result = await messagingService.send(actor.data.userId, submissionId, input);
  if (!result.ok) {
    if (result.code === "forbidden" || result.code === "unauthenticated") {
      return { ok: false, code: result.code, message: result.message };
    }
    return mentorInvalid(result.message, result.fieldErrors);
  }

  return { ok: true, data: { submissionId: result.data.submissionId } };
}
