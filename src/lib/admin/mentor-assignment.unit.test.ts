import { describe, expect, it } from "vitest";

import {
  isDuplicateActiveAssignment,
  isEligibleMentor,
  mentorChoiceLabel,
  rankEligibleMentors,
  statusAfterAssignment,
  type EligibleMentor,
  type MentorEligibility,
} from "@/lib/admin/mentor-assignment";

const eligible: MentorEligibility = {
  role: "MENTOR",
  approvalStatus: "APPROVED",
  deactivatedAt: null,
  supportsStack: true,
};

function mentor(id: string, name: string, activeAssignmentCount: number): EligibleMentor {
  return { id, name, activeAssignmentCount };
}

describe("mentor assignment rules", () => {
  it("accepts only an approved active mentor for the submission tech stack", () => {
    expect(isEligibleMentor(eligible)).toBe(true);
    expect(isEligibleMentor({ ...eligible, approvalStatus: "PENDING" })).toBe(false);
    expect(isEligibleMentor({ ...eligible, approvalStatus: "REJECTED" })).toBe(false);
    expect(isEligibleMentor({ ...eligible, deactivatedAt: new Date() })).toBe(false);
    expect(isEligibleMentor({ ...eligible, role: "ADMIN" })).toBe(false);
    expect(isEligibleMentor({ ...eligible, role: "STUDENT" })).toBe(false);
    expect(isEligibleMentor({ ...eligible, supportsStack: false })).toBe(false);
  });

  it("orders mentors by current load and does not choose one", () => {
    const busy = mentor("busy", "Alpha Mentor", 4);
    const light = mentor("light", "Zulu Mentor", 0);
    const tied = mentor("tied", "Middle Mentor", 0);
    const original = [busy, light, tied];

    expect(rankEligibleMentors(original).map((item) => item.id)).toEqual(["tied", "light", "busy"]);
    expect(original.map((item) => item.id)).toEqual(["busy", "light", "tied"]);
    expect(mentorChoiceLabel(light)).toBe("Zulu Mentor · 0 active assignments");
    expect(mentorChoiceLabel(mentor("one", "Ada Mentor", 1))).toBe("Ada Mentor · 1 active assignment");
  });

  it("moves only a pending submission to assigned and rejects a second active mentor", () => {
    expect(statusAfterAssignment("PENDING")).toEqual({ assignable: true, status: "ASSIGNED", changed: true });
    expect(statusAfterAssignment("IN_REVIEW")).toEqual({ assignable: true, status: "IN_REVIEW", changed: false });
    expect(statusAfterAssignment("CLOSED")).toEqual({ assignable: false });
    expect(isDuplicateActiveAssignment(null, "mentor-1")).toBe(false);
    expect(isDuplicateActiveAssignment("mentor-1", "mentor-1")).toBe(true);
    expect(isDuplicateActiveAssignment("mentor-1", "mentor-2")).toBe(false);
  });
});
