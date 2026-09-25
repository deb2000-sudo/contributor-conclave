import type { PRSubmissionStatus } from "@/generated/prisma/client";

import { db } from "@/lib/db";

export type QueuedSubmission = {
  id: string;
  studentName: string;
  repository: string;
  githubPrUrl: string;
  techStack: string;
  status: PRSubmissionStatus;
  submittedAt: Date;
};

export async function listSubmissionQueue(): Promise<QueuedSubmission[]> {
  const submissions = await db.pRSubmission.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      repository: true,
      githubPrUrl: true,
      status: true,
      submittedAt: true,
      techStack: { select: { name: true } },
      student: {
        select: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  return submissions.map((submission) => ({
    id: submission.id,
    studentName: `${submission.student.user.firstName} ${submission.student.user.lastName}`,
    repository: submission.repository,
    githubPrUrl: submission.githubPrUrl,
    techStack: submission.techStack.name,
    status: submission.status,
    submittedAt: submission.submittedAt,
  }));
}
