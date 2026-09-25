import { describe, expect, it } from "vitest";

import { readPage, readSubmissionStatus, readText } from "@/lib/mentor/query";
import { messageSchema, reviewSchema } from "@/lib/mentor/validation";

describe("mentor review validation", () => {
  it("accepts approve and request-changes comments and rejects other decisions", () => {
    expect(reviewSchema.safeParse({ decision: "APPROVED", comment: " Ship it. " }).data).toEqual({
      decision: "APPROVED",
      comment: "Ship it.",
    });
    expect(reviewSchema.safeParse({ decision: "CHANGES_REQUESTED", comment: "Rename the helper." }).success).toBe(
      true,
    );
    expect(reviewSchema.safeParse({ decision: "REJECTED", comment: "No." }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "ADMIN", comment: "No.", role: "ADMIN" }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "APPROVED", comment: "  " }).success).toBe(false);
    expect(messageSchema.safeParse("  Hello  ").data).toBe("Hello");
    expect(messageSchema.safeParse(" ").success).toBe(false);
    expect(readText("x".repeat(200))).toHaveLength(80);
    expect(readPage("0")).toBe(1);
    expect(readPage("10001")).toBe(1);
    expect(readSubmissionStatus("ASSIGNED")).toBe("ASSIGNED");
    expect(readSubmissionStatus("NOT_A_STATUS")).toBe("all");
  });
});
