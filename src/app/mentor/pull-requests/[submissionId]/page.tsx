import Link from "next/link";

import { FactList } from "@/components/student/fact-list";
import { TextLink } from "@/components/student/text-link";
import { MessageForm } from "@/components/chat/message-form";
import { ReviewForm, StartReviewForm } from "@/components/mentor/forms";
import { MentorNote, MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { focusRing } from "@/components/ui/styles";
import { requireMentor } from "@/lib/auth/authorization";
import { getPullRequest } from "@/lib/mentor/reviews";
import { formatTimestamp, reviewLabel, submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Review pull request" };

export default async function MentorPullRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ started?: string; reviewed?: string; sent?: string }>;
}) {
  const mentor = await requireMentor();
  const { submissionId } = await params;
  const query = await searchParams;
  const result = await getPullRequest(mentor.id, submissionId);

  if (!result.ok) {
    return (
      <MentorSection
        crumb="Assigned pull requests"
        title="Review pull request"
        description="A pull request assigned to you."
      >
        <ErrorState title="Pull request unavailable" message={result.message} />
      </MentorSection>
    );
  }

  const pull = result.data;
  const status = submissionLabel(pull.status);
  const review = reviewLabel(pull.reviewState);
  const note =
    query.reviewed === "1"
      ? "The review was saved and the student was notified."
      : query.started === "1"
        ? "The submission is now in review."
        : query.sent === "1"
          ? "The message was sent."
          : null;

  return (
    <MentorSection
      crumb="Assigned pull requests"
      title={pull.repository}
      description="Review the assigned pull request and write to the student."
    >
      {note ? <MentorNote>{note}</MentorNote> : null}
      <FactList
        facts={[
          {
            label: "Student",
            value: (
              <Link href={`/mentor/students/${pull.studentUserId}`} className={`underline underline-offset-4 ${focusRing}`}>
                {pull.studentName}
              </Link>
            ),
          },
          { label: "Repository", value: pull.repository },
          { label: "Pull request", value: <TextLink href={pull.githubPrUrl}>Open pull request</TextLink> },
          { label: "Tech stack", value: pull.techStack },
          {
            label: "Submission date",
            value: <time dateTime={pull.submittedAt.toISOString()}>{formatTimestamp(pull.submittedAt)}</time>,
          },
          { label: "Current status", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
          { label: "Review status", value: <StatusBadge tone={review.tone}>{review.label}</StatusBadge> },
        ]}
      />

      <section className="flex flex-col gap-4" aria-labelledby="review-heading">
        <h2 id="review-heading" className="text-lg font-semibold">
          Review
        </h2>
        {pull.canStart ? <StartReviewForm submissionId={pull.submissionId} /> : null}
        {pull.canReview ? (
          <ReviewForm submissionId={pull.submissionId} />
        ) : (
          <p className="text-ink/75 dark:text-paper/75">This submission is closed to new reviews.</p>
        )}
        {pull.reviewsTruncated ? (
          <p className="text-sm text-ink/70 dark:text-paper/70">Showing the latest 20 reviews.</p>
        ) : null}
        {pull.reviews.length === 0 ? (
          <p className="text-ink/75 dark:text-paper/75">No reviews yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {pull.reviews.map((item) => {
              const decision = reviewLabel(item.decision);
              return (
                <li key={item.id} className="border-t border-ink/10 pt-3 dark:border-paper/10">
                  <p className="text-sm text-ink/70 dark:text-paper/70">
                    {item.mentorName}
                    {" · "}
                    <time dateTime={item.createdAt.toISOString()}>{formatTimestamp(item.createdAt)}</time>
                  </p>
                  <p className="mt-1">
                    <StatusBadge tone={decision.tone}>{decision.label}</StatusBadge>
                  </p>
                  <p className="mt-2 break-words whitespace-pre-wrap">{item.comment}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="message-heading">
        <h2 id="message-heading" className="text-lg font-semibold">
          Messages
        </h2>
        {pull.messagesTruncated ? (
          <p className="text-sm text-ink/70 dark:text-paper/70">Showing the latest 30 messages.</p>
        ) : null}
        {pull.messages.length === 0 ? (
          <p className="text-ink/75 dark:text-paper/75">No messages with this student yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {pull.messages.map((message) => (
              <li key={message.id} className="border-t border-ink/10 pt-3 dark:border-paper/10">
                <p className="text-sm text-ink/70 dark:text-paper/70">
                  {message.senderName}
                  {" · "}
                  <time dateTime={message.createdAt.toISOString()}>{formatTimestamp(message.createdAt)}</time>
                </p>
                <p className="mt-1 break-words whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
          </ol>
        )}
        <MessageForm submissionId={pull.submissionId} returnTo={`/mentor/pull-requests/${pull.submissionId}`} />
      </section>
    </MentorSection>
  );
}
