import { AssignmentStatus, AuditAction, MentorApprovalStatus, PRSubmissionStatus } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { accountLabel, approvalLabel, assignmentLabel, auditActionLabel } from "@/lib/admin/labels";
import { readAccount, readPage, readSubmissionStatus, readText } from "@/lib/admin/query";
import { mentorDecisionSchema, profileUpdateSchema } from "@/lib/admin/validation";

describe("admin query and labels", () => {
  it("bounds search text and page numbers", () => {
    expect(readText(["  Ada  "])).toBe("Ada");
    expect(readText("x".repeat(200))).toHaveLength(80);
    expect(readPage("2")).toBe(2);
    expect(readPage("0")).toBe(1);
    expect(readPage("nope")).toBe(1);
    expect(readAccount("deactivated")).toBe("deactivated");
    expect(readAccount("mentor")).toBe("all");
    expect(readSubmissionStatus("PENDING")).toBe("PENDING");
    expect(readSubmissionStatus("SUBMITTED")).toBe("all");
  });

  it("labels every audit action, approval, and assignment status", () => {
    expect(Object.values(AuditAction).map((action) => auditActionLabel(action))).toHaveLength(
      Object.values(AuditAction).length,
    );
    expect(Object.values(MentorApprovalStatus).map((status) => approvalLabel(status).label)).toEqual([
      "Pending",
      "Approved",
      "Rejected",
    ]);
    expect(Object.values(AssignmentStatus).map((status) => assignmentLabel(status))).toEqual([
      "Active",
      "Reassigned",
      "Cancelled",
      "Completed",
    ]);
    expect(accountLabel(null).label).toBe("Active");
    expect(accountLabel(new Date()).label).toBe("Deactivated");
    expect(Object.values(PRSubmissionStatus)).toContain("ASSIGNED");
  });

  it("accepts profile edits and mentor decisions without a role field", () => {
    const parsed = profileUpdateSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      batch: "Batch 24",
      universityName: "Example University",
      role: "ADMIN",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data).not.toHaveProperty("role");
    expect(mentorDecisionSchema.safeParse("APPROVED").success).toBe(true);
    expect(mentorDecisionSchema.safeParse("ADMIN").success).toBe(false);
  });
});
