-- Mentor approval is required before an administrator can assign that mentor.
CREATE TYPE "MentorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);

ALTER TABLE "mentor_profiles"
  ADD COLUMN "approval_status" "MentorApprovalStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE "mentor_tech_stacks" (
  "mentor_id" UUID NOT NULL,
  "tech_stack_id" UUID NOT NULL,

  CONSTRAINT "mentor_tech_stacks_pkey" PRIMARY KEY ("mentor_id", "tech_stack_id")
);

ALTER TABLE "mentor_tech_stacks"
  ADD CONSTRAINT "mentor_tech_stacks_mentor_id_fkey"
  FOREIGN KEY ("mentor_id") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mentor_tech_stacks"
  ADD CONSTRAINT "mentor_tech_stacks_tech_stack_id_fkey"
  FOREIGN KEY ("tech_stack_id") REFERENCES "tech_stacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_deactivated_at_idx" ON "users"("deactivated_at");
CREATE INDEX "mentor_profiles_approval_status_idx" ON "mentor_profiles"("approval_status");
CREATE INDEX "mentor_tech_stacks_tech_stack_id_idx" ON "mentor_tech_stacks"("tech_stack_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE TYPE "AuditAction_new" AS ENUM (
  'MENTOR_ASSIGNED',
  'MENTOR_REASSIGNED',
  'ASSIGNMENT_CANCELLED',
  'USER_ROLE_CHANGED',
  'SUBMISSION_CLOSED',
  'SUBMISSION_SUBMITTED',
  'STUDENT_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'MENTOR_APPROVED',
  'MENTOR_REJECTED',
  'MENTOR_UPDATED',
  'TECH_STACK_CREATED',
  'TECH_STACK_UPDATED'
);

ALTER TABLE "audit_logs"
  ALTER COLUMN "action" TYPE "AuditAction_new"
  USING ("action"::text::"AuditAction_new");

DROP TYPE "AuditAction";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";

CREATE TYPE "AuditTargetType_new" AS ENUM (
  'USER',
  'PR_SUBMISSION',
  'MENTOR_ASSIGNMENT',
  'PR_REVIEW',
  'TECH_STACK'
);

ALTER TABLE "audit_logs"
  ALTER COLUMN "target_type" TYPE "AuditTargetType_new"
  USING ("target_type"::text::"AuditTargetType_new");

DROP TYPE "AuditTargetType";
ALTER TYPE "AuditTargetType_new" RENAME TO "AuditTargetType";
