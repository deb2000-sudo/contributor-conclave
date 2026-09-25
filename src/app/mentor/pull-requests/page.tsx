import { PRSubmissionStatus } from "@/generated/prisma/client";

import { AdminFilters, ChoiceFilter, SearchFilter } from "@/components/admin/filters";
import { Pager } from "@/components/admin/pager";
import { PullRequestTable } from "@/components/mentor/pull-request-table";
import { MentorSection } from "@/components/mentor/section";
import { ErrorState } from "@/components/ui/error-state";
import { requireMentor } from "@/lib/auth/authorization";
import { listAssignedPullRequests, listSubmissionStacks } from "@/lib/mentor/directory";
import { pageQuery, readOptionalUuid, readPage, readSubmissionStatus, readText } from "@/lib/mentor/query";
import { submissionLabel } from "@/lib/student/labels";

export const metadata = { title: "Assigned pull requests" };

export default async function MentorPullRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; techStack?: string; page?: string }>;
}) {
  const mentor = await requireMentor();
  const params = await searchParams;
  const search = readText(params.q);
  const status = readSubmissionStatus(params.status);
  const techStackId = readOptionalUuid(params.techStack);
  const [result, stacks] = await Promise.all([
    listAssignedPullRequests(mentor.id, { page: readPage(params.page), search, status, techStackId }),
    listSubmissionStacks(mentor.id),
  ]);

  if (!result.ok) {
    return (
      <MentorSection
        crumb="Assigned pull requests"
        title="Assigned pull requests"
        description="Pull requests an administrator assigned to you."
      >
        <ErrorState title="Pull requests unavailable" message={result.message} />
      </MentorSection>
    );
  }

  if (!stacks.ok) {
    return (
      <MentorSection
        crumb="Assigned pull requests"
        title="Assigned pull requests"
        description="Pull requests an administrator assigned to you."
      >
        <ErrorState title="Pull requests unavailable" message={stacks.message} />
      </MentorSection>
    );
  }

  const href = (page: number) =>
    `/mentor/pull-requests${pageQuery(page, {
      q: search || null,
      status: status === "all" ? null : status,
      techStack: techStackId,
    })}`;

  return (
    <MentorSection
      crumb="Assigned pull requests"
      title="Assigned pull requests"
      description="Filter by tech stack or status, then open a pull request to review it."
    >
      <AdminFilters action="/mentor/pull-requests">
        <SearchFilter defaultValue={search} />
        <ChoiceFilter
          id="mentor-submission-status"
          name="status"
          label="Status"
          value={status}
          options={[
            { value: "all", label: "All" },
            ...Object.values(PRSubmissionStatus).map((value) => ({
              value,
              label: submissionLabel(value).label,
            })),
          ]}
        />
        <ChoiceFilter
          id="mentor-submission-stack"
          name="techStack"
          label="Tech stack"
          value={techStackId ?? ""}
          options={[{ value: "", label: "All" }, ...stacks.data.map((stack) => ({ value: stack.id, label: stack.name }))]}
        />
      </AdminFilters>
      <PullRequestTable
        items={result.data.items}
        emptyTitle="No assigned pull requests"
        emptyDescription="A pull request appears here after an administrator assigns it to you."
      />
      <Pager page={result.data.page} total={result.data.total} pageSize={result.data.pageSize} href={href} />
    </MentorSection>
  );
}
