-- Supports admin counts and lists filtered by role and account state.
CREATE INDEX "users_role_deactivated_at_idx" ON "users"("role", "deactivated_at");

-- Supports a student's submissions ordered by the time they were submitted.
CREATE INDEX "pr_submissions_student_id_submitted_at_idx" ON "pr_submissions"("student_id", "submitted_at");
