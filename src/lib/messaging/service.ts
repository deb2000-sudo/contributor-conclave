import { Prisma, type MessageStatus } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { encryptMessageBody, openStoredMessage } from "@/lib/messaging/crypto";
import {
  MESSAGE_PAGE_SIZE,
  MESSAGE_RATE_WINDOW_MS,
  parseMessageBody,
  rateLimitAllows,
} from "@/lib/messaging/policy";
import { z } from "zod";

export type MessagingError = {
  ok: false;
  code: "unauthenticated" | "forbidden" | "invalid" | "limited";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type MessagingSuccess<T> = { ok: true; data: T };

export type ChatMessage = {
  id: string;
  text: string;
  createdAt: Date;
  senderName: string;
  own: boolean;
  status: MessageStatus;
};

export type ConversationPage = {
  submissionId: string;
  repository: string;
  githubPrUrl: string;
  counterpartName: string;
  messages: ChatMessage[];
  olderCursor: string | null;
};

export type ConversationSummary = {
  submissionId: string;
  repository: string;
  githubPrUrl: string;
  counterpartName: string;
  unreadCount: number;
  latestText: string | null;
  latestAt: Date | null;
};

type ConversationStore = Prisma.TransactionClient;

function parseUuid(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

function forbidden(): MessagingError {
  return { ok: false, code: "forbidden", message: "You do not have access to this conversation." };
}

function invalid(message: string, fieldErrors?: Record<string, string[]>): MessagingError {
  return { ok: false, code: "invalid", message, fieldErrors };
}

export async function ensureAssignmentConversation(
  tx: ConversationStore,
  input: { submissionId: string; studentUserId: string; mentorUserId: string },
): Promise<string> {
  const conversation = await tx.conversation.upsert({
    where: { prSubmissionId: input.submissionId },
    create: { prSubmissionId: input.submissionId },
    update: {},
    select: { id: true },
  });
  const memberIds = [input.studentUserId, input.mentorUserId];

  for (const userId of memberIds) {
    await tx.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId } },
      create: { conversationId: conversation.id, userId },
      update: {},
    });
  }

  await tx.conversationParticipant.deleteMany({
    where: { conversationId: conversation.id, userId: { notIn: memberIds } },
  });

  return conversation.id;
}

async function authorize(userId: string, submissionId: string) {
  if (!parseUuid(userId) || !parseUuid(submissionId)) {
    return forbidden();
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, deactivatedAt: true },
  });

  if (!user) {
    return { ok: false, code: "unauthenticated", message: "Authentication required." } as const;
  }

  if (user.deactivatedAt) {
    return forbidden();
  }

  const submission = await db.pRSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      repository: true,
      githubPrUrl: true,
      student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
      assignments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          mentor: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  if (!submission) {
    return forbidden();
  }

  const mentor = submission.assignments[0]?.mentor;
  const studentUserId = submission.student.userId;
  const mentorUserId = mentor?.userId ?? null;
  const allowed = user.id === studentUserId || (mentorUserId !== null && user.id === mentorUserId);

  if (!allowed || !mentorUserId) {
    return forbidden();
  }

  const counterpart = user.id === studentUserId ? mentor.user : submission.student.user;

  return {
    ok: true as const,
    data: {
      userId: user.id,
      submissionId: submission.id,
      repository: submission.repository,
      githubPrUrl: submission.githubPrUrl,
      studentUserId,
      mentorUserId,
      counterpartName: `${counterpart.firstName} ${counterpart.lastName}`,
    },
  };
}

function visibleText(protection: "SERVER" | "E2EE", stored: string): string {
  const opened = openStoredMessage(protection, stored);
  return opened.text ?? "This message is protected and cannot be shown here.";
}

async function send(userId: string, submissionId: string, input: unknown): Promise<MessagingSuccess<{ submissionId: string }> | MessagingError> {
  const parsed = parseMessageBody(input);
  if (!parsed.ok) {
    return invalid(parsed.message, parsed.fieldErrors);
  }

  const actor = await authorize(userId, submissionId);
  if (!actor.ok) {
    return actor;
  }

  try {
    await db.$transaction(async (tx) => {
      const recent = await tx.message.count({
        where: {
          senderId: actor.data.userId,
          createdAt: { gte: new Date(Date.now() - MESSAGE_RATE_WINDOW_MS) },
        },
      });
      if (!rateLimitAllows(recent)) {
        throw new Error("rate-limit");
      }

      const conversationId = await ensureAssignmentConversation(tx, actor.data);
      await tx.message.create({
        data: {
          conversationId,
          senderId: actor.data.userId,
          body: encryptMessageBody(parsed.data),
          protection: "SERVER",
          status: "SENT",
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      const recipientId = actor.data.userId === actor.data.studentUserId ? actor.data.mentorUserId : actor.data.studentUserId;
      await tx.notification.create({
        data: {
          recipientId,
          type: "MESSAGE_RECEIVED",
          prSubmissionId: actor.data.submissionId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.data.userId,
          action: "MESSAGE_SENT",
          targetType: "PR_SUBMISSION",
          targetId: actor.data.submissionId,
          detail: `submission=${actor.data.submissionId}`.slice(0, 500),
        },
      });
    });

    return { ok: true, data: { submissionId: actor.data.submissionId } };
  } catch (error) {
    if (error instanceof Error && error.message === "rate-limit") {
      return { ok: false, code: "limited", message: "You sent too many messages. Wait a minute and try again." };
    }
    logError("messaging.send_failed", { actorId: userId });
    return invalid("The message could not be sent. Try again.");
  }
}

async function getConversation(
  userId: string,
  submissionId: string,
  before: string | null,
): Promise<MessagingSuccess<ConversationPage> | MessagingError> {
  const actor = await authorize(userId, submissionId);
  if (!actor.ok) {
    return actor;
  }

  const beforeId = before && parseUuid(before) ? before : null;

  try {
    const page = await db.$transaction(async (tx) => {
      const conversationId = await ensureAssignmentConversation(tx, actor.data);
      const cursor = beforeId
        ? await tx.message.findFirst({
            where: { id: beforeId, conversationId },
            select: { id: true, createdAt: true },
          })
        : null;

      const rows = await tx.message.findMany({
        where: {
          conversationId,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MESSAGE_PAGE_SIZE + 1,
        select: {
          id: true,
          body: true,
          protection: true,
          status: true,
          createdAt: true,
          senderId: true,
          sender: { select: { firstName: true, lastName: true } },
        },
      });

      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: actor.data.userId } },
        data: { lastReadAt: new Date() },
      });
      await tx.message.updateMany({
        where: { conversationId, senderId: { not: actor.data.userId }, status: "SENT" },
        data: { status: "READ" },
      });

      const hasOlder = rows.length > MESSAGE_PAGE_SIZE;
      const visible = (hasOlder ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows).slice().reverse();
      const messages = visible.map((message) => ({
        id: message.id,
        text: visibleText(message.protection, message.body),
        createdAt: message.createdAt,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
        own: message.senderId === actor.data.userId,
        status: message.senderId === actor.data.userId ? message.status : "READ",
      }));

      return {
        submissionId: actor.data.submissionId,
        repository: actor.data.repository,
        githubPrUrl: actor.data.githubPrUrl,
        counterpartName: actor.data.counterpartName,
        messages,
        olderCursor: hasOlder ? (visible[0]?.id ?? null) : null,
      };
    });

    return { ok: true, data: page };
  } catch {
    logError("messaging.read_failed", { actorId: userId });
    return invalid("The conversation could not be loaded. Try again.");
  }
}

async function unreadCounts(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db.$queryRaw<Array<{ conversation_id: string; unread: number }>>(Prisma.sql`
    SELECT m.conversation_id, COUNT(*)::int AS unread
    FROM messages m
    INNER JOIN conversation_participants p
      ON p.conversation_id = m.conversation_id
     AND p.user_id = ${userId}::uuid
    WHERE m.conversation_id IN (${Prisma.join(conversationIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND m.sender_id <> ${userId}::uuid
      AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
    GROUP BY m.conversation_id
  `);

  return new Map(rows.map((row) => [row.conversation_id, Number(row.unread)]));
}

async function listConversations(
  userId: string,
  pageNumber: number,
): Promise<MessagingSuccess<{ items: ConversationSummary[]; page: number; pageSize: number; total: number }> | MessagingError> {
  if (!parseUuid(userId)) {
    return forbidden();
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, deactivatedAt: true },
  });
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "Authentication required." };
  }
  if (user.deactivatedAt) {
    return forbidden();
  }

  const where = {
    status: "ACTIVE" as const,
    OR: [{ student: { userId } }, { mentor: { userId } }],
  };
  const total = await db.mentorAssignment.count({ where });
  const page = Math.min(Math.max(pageNumber, 1), Math.max(1, Math.ceil(total / MESSAGE_PAGE_SIZE)));
  const assignments = total === 0
    ? []
    : await db.mentorAssignment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * MESSAGE_PAGE_SIZE,
        take: MESSAGE_PAGE_SIZE,
        select: {
          prSubmission: {
            select: {
              id: true,
              repository: true,
              githubPrUrl: true,
              student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
              conversation: {
                select: {
                  id: true,
                  participants: { where: { userId }, select: { lastReadAt: true } },
                  messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { body: true, protection: true, createdAt: true },
                  },
                },
              },
            },
          },
          mentor: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
        },
      });

  const unreadByConversation = await unreadCounts(
    userId,
    assignments.flatMap((assignment) => {
      const conversationId = assignment.prSubmission.conversation?.id;
      return conversationId ? [conversationId] : [];
    }),
  );
  const items = assignments.map((assignment) => {
    const submission = assignment.prSubmission;
    const conversation = submission.conversation;
    const latest = conversation?.messages[0] ?? null;
    const counterpart = submission.student.userId === userId ? assignment.mentor.user : submission.student.user;
    return {
      submissionId: submission.id,
      repository: submission.repository,
      githubPrUrl: submission.githubPrUrl,
      counterpartName: `${counterpart.firstName} ${counterpart.lastName}`,
      unreadCount: conversation ? (unreadByConversation.get(conversation.id) ?? 0) : 0,
      latestText: latest ? visibleText(latest.protection, latest.body).slice(0, 160) : null,
      latestAt: latest?.createdAt ?? null,
    };
  });

  return { ok: true, data: { items, page, pageSize: MESSAGE_PAGE_SIZE, total } };
}

export const messagingService = {
  send,
  getConversation,
  listConversations,
};
