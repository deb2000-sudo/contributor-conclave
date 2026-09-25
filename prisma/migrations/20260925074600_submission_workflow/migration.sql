-- Explicit pull-request workflow statuses. Existing rows map into the new set.
CREATE TYPE "PRSubmissionStatus_new" AS ENUM (
  'PENDING',
  'ASSIGNED',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CLOSED'
);

ALTER TABLE "pr_submissions" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "pr_submissions"
  ALTER COLUMN "status" TYPE "PRSubmissionStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'PENDING'
      WHEN 'IN_REVIEW' THEN 'IN_REVIEW'
      WHEN 'COMPLETED' THEN 'APPROVED'
      WHEN 'CLOSED' THEN 'CLOSED'
    END
  )::"PRSubmissionStatus_new";

ALTER TABLE "pr_submissions"
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PRSubmissionStatus_new";

DROP TYPE "PRSubmissionStatus";

ALTER TYPE "PRSubmissionStatus_new" RENAME TO "PRSubmissionStatus";

-- Record the initial PENDING status when a student submits a pull request.
CREATE TYPE "AuditAction_new" AS ENUM (
  'MENTOR_ASSIGNED',
  'MENTOR_REASSIGNED',
  'ASSIGNMENT_CANCELLED',
  'USER_ROLE_CHANGED',
  'SUBMISSION_CLOSED',
  'SUBMISSION_SUBMITTED'
);

ALTER TABLE "audit_logs"
  ALTER COLUMN "action" TYPE "AuditAction_new"
  USING ("action"::text::"AuditAction_new");

DROP TYPE "AuditAction";

ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";

-- Tech stacks a student can choose when submitting a pull request.
INSERT INTO "tech_stacks" ("id", "name", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Go', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Java', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'JavaScript', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Next.js', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Python', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'React', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Rust', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'TypeScript', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
