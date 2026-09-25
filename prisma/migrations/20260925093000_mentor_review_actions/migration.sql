-- Mentor review and chat actions are recorded without message or comment text.
CREATE TYPE "AuditAction_new" AS ENUM (
  'MENTOR_ASSIGNED',
  'MENTOR_REASSIGNED',
  'ASSIGNMENT_CANCELLED',
  'USER_ROLE_CHANGED',
  'SUBMISSION_CLOSED',
  'SUBMISSION_SUBMITTED',
  'REVIEW_STARTED',
  'REVIEW_POSTED',
  'MESSAGE_SENT',
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
