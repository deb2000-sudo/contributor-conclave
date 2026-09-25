import { Prisma, type PRSubmissionStatus, type ReviewDecision, type ReviewState } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { openStoredMessage } from "@/lib/messaging/crypto";

export type StudentReview = {
  decision: ReviewDecision;
  comment: string;
  createdAt: Date;
};

export type StudentSubmission = {
  id: string;
  githubPrUrl: string;
  repository: string;
  techStack: string;
  status: PRSubmissionStatus;
  reviewState: ReviewState;
  submittedAt: Date;
  mentorName: string | null;
  latestReview: StudentReview | null;
};

export type StudentMentor = {
  assignmentId: string;
  name: string;
  email: string;
  githubUsername: string | null;
  repository: string;
  githubPrUrl: string;
  reviewState: ReviewState;
};

export type StudentDashboard = {
  firstName: string;
  lastName: string;
  email: string;
  niatId: string;
  batch: string;
  universityName: string;
  githubUsername: string | null;
  submissions: StudentSubmission[];
  mentors: StudentMentor[];
};

export type StudentChatMessage = {
  id: string;
  body: string;
  createdAt: Date;
  senderName: string;
};

export type StudentConversation = {
  id: string;
  repository: string;
  githubPrUrl: string;
  truncated: boolean;
  messages: StudentChatMessage[];
};

const MESSAGE_WINDOW = 30;
const OVERVIEW_SUBMISSIONS = 5;
export const STUDENT_SUBMISSION_PAGE_SIZE = 20;

const submissionListSelect = {
  id: true,
  githubPrUrl: true,
  repository: true,
  status: true,
  reviewState: true,
  submittedAt: true,
  techStack: { select: { name: true } },
  assignments: {
    where: { status: "ACTIVE" as const },
    take: 1,
    select: {
      mentor: {
        select: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  },
} satisfies Prisma.PRSubmissionSelect;

function listedSubmission(
  submission: Prisma.PRSubmissionGetPayload<{ select: typeof submissionListSelect }>,
): StudentSubmission {
  const mentor = submission.assignments[0]?.mentor.user;
  return {
    id: submission.id,
    githubPrUrl: submission.githubPrUrl,
    repository: submission.repository,
    techStack: submission.techStack.name,
    status: submission.status,
    reviewState: submission.reviewState,
    submittedAt: submission.submittedAt,
    mentorName: mentor ? `${mentor.firstName} ${mentor.lastName}` : null,
    latestReview: null,
  };
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboard | null> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: {
      niatId: true,
      batch: true,
      universityName: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          githubAccount: { select: { username: true } },
        },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          githubPrUrl: true,
          repository: true,
          status: true,
          reviewState: true,
          submittedAt: true,
          techStack: { select: { name: true } },
          assignments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              mentor: {
                select: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { decision: true, comment: true, createdAt: true },
          },
        },
      },
      assignments: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          prSubmission: {
            select: { repository: true, githubPrUrl: true, reviewState: true },
          },
          mentor: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  githubAccount: { select: { username: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    niatId: profile.niatId,
    batch: profile.batch,
    universityName: profile.universityName,
    githubUsername: profile.user.githubAccount?.username ?? null,
    submissions: profile.submissions.map((submission) => {
      const mentor = submission.assignments[0]?.mentor.user;
      const review = submission.reviews[0] ?? null;
      return {
        id: submission.id,
        githubPrUrl: submission.githubPrUrl,
        repository: submission.repository,
        techStack: submission.techStack.name,
        status: submission.status,
        reviewState: submission.reviewState,
        submittedAt: submission.submittedAt,
        mentorName: mentor ? `${mentor.firstName} ${mentor.lastName}` : null,
        latestReview: review,
      };
    }),
    mentors: profile.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      name: `${assignment.mentor.user.firstName} ${assignment.mentor.user.lastName}`,
      email: assignment.mentor.user.email,
      githubUsername: assignment.mentor.user.githubAccount?.username ?? null,
      repository: assignment.prSubmission.repository,
      githubPrUrl: assignment.prSubmission.githubPrUrl,
      reviewState: assignment.prSubmission.reviewState,
    })),
  };
}

export type StudentAccount = {
  firstName: string;
  lastName: string;
  email: string;
  niatId: string;
  batch: string;
  universityName: string;
  githubUsername: string | null;
};

export type StudentOverviewLists = {
  counts: { pending: number; approved: number; changes: number };
  submissions: StudentSubmission[];
  mentors: StudentMentor[];
};

export type StudentSubmissionPage = {
  githubUsername: string | null;
  submissions: StudentSubmission[];
  page: number;
  pageSize: number;
  total: number;
};

const accountSelect = {
  niatId: true,
  batch: true,
  universityName: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      githubAccount: { select: { username: true } },
    },
  },
} as const;

function toAccount(profile: {
  niatId: string;
  batch: string;
  universityName: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    githubAccount: { username: string } | null;
  };
}): StudentAccount {
  return {
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    niatId: profile.niatId,
    batch: profile.batch,
    universityName: profile.universityName,
    githubUsername: profile.user.githubAccount?.username ?? null,
  };
}

const mentorAssignmentSelect = {
  id: true,
  prSubmission: {
    select: { repository: true, githubPrUrl: true, reviewState: true },
  },
  mentor: {
    select: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          githubAccount: { select: { username: true } },
        },
      },
    },
  },
} as const;

function toMentor(
  assignment: Prisma.MentorAssignmentGetPayload<{ select: typeof mentorAssignmentSelect }>,
): StudentMentor {
  return {
    assignmentId: assignment.id,
    name: `${assignment.mentor.user.firstName} ${assignment.mentor.user.lastName}`,
    email: assignment.mentor.user.email,
    githubUsername: assignment.mentor.user.githubAccount?.username ?? null,
    repository: assignment.prSubmission.repository,
    githubPrUrl: assignment.prSubmission.githubPrUrl,
    reviewState: assignment.prSubmission.reviewState,
  };
}

export async function getStudentAccount(userId: string): Promise<StudentAccount | null> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: accountSelect,
  });
  return profile ? toAccount(profile) : null;
}

export async function getStudentMentors(userId: string): Promise<StudentMentor[] | null> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: {
      assignments: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: mentorAssignmentSelect,
      },
    },
  });
  return profile ? profile.assignments.map(toMentor) : null;
}

export async function getStudentOverviewLists(userId: string): Promise<StudentOverviewLists | null> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return null;
  }

  const [grouped, submissions, assignments] = await Promise.all([
    db.pRSubmission.groupBy({
      by: ["reviewState"],
      where: { studentId: profile.id },
      _count: { _all: true },
    }),
    db.pRSubmission.findMany({
      where: { studentId: profile.id },
      orderBy: { submittedAt: "desc" },
      take: OVERVIEW_SUBMISSIONS,
      select: submissionListSelect,
    }),
    db.mentorAssignment.findMany({
      where: { studentId: profile.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: mentorAssignmentSelect,
    }),
  ]);

  const counts = { pending: 0, approved: 0, changes: 0 };
  for (const row of grouped) {
    if (row.reviewState === "PENDING") {
      counts.pending = row._count._all;
    } else if (row.reviewState === "APPROVED") {
      counts.approved = row._count._all;
    } else if (row.reviewState === "CHANGES_REQUESTED") {
      counts.changes = row._count._all;
    }
  }

  return {
    counts,
    submissions: submissions.map(listedSubmission),
    mentors: assignments.map(toMentor),
  };
}

export async function listStudentSubmissions(
  userId: string,
  pageNumber: number,
): Promise<StudentSubmissionPage | null> {
  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: { id: true, user: { select: { githubAccount: { select: { username: true } } } } },
  });
  if (!profile) {
    return null;
  }

  const where = { studentId: profile.id };
  const total = await db.pRSubmission.count({ where });
  const pageSize = STUDENT_SUBMISSION_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(pageNumber, 1), pages);
  const submissions = await db.pRSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: submissionListSelect,
  });

  return {
    githubUsername: profile.user.githubAccount?.username ?? null,
    submissions: submissions.map(listedSubmission),
    page,
    pageSize,
    total,
  };
}

export async function getStudentConversations(userId: string): Promise<StudentConversation[]> {
  const conversations = await db.conversation.findMany({
    where: {
      participants: { some: { userId } },
      prSubmission: { student: { userId } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      prSubmission: { select: { repository: true, githubPrUrl: true } },
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
  });

  return conversations.map((conversation) => {
    const truncated = conversation.messages.length > MESSAGE_WINDOW;
    const visible = (truncated ? conversation.messages.slice(0, MESSAGE_WINDOW) : conversation.messages)
      .slice()
      .reverse();

    return {
      id: conversation.id,
      repository: conversation.prSubmission.repository,
      githubPrUrl: conversation.prSubmission.githubPrUrl,
      truncated,
      messages: visible.map((message) => ({
        id: message.id,
        body: openStoredMessage(message.protection, message.body).text ?? "This message is protected and cannot be shown here.",
        createdAt: message.createdAt,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      })),
    };
  });
}
