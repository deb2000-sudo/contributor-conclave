/** Test-only values. Never use these as production credentials. */
export const TEST_MESSAGE_KEY = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

export const E2E_PASSWORD = "Test-password-1";
export const E2E_DOMAIN = "@e2e.test";
export const E2E_STACK_PREFIX = "E2E ";
export const E2E_STACK_NAME = "E2E TypeScript";
export const E2E_PRIVATE_MESSAGE = "private-other-thread";

export const E2E_IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  student: "00000000-0000-4000-8000-000000000002",
  mentor: "00000000-0000-4000-8000-000000000003",
  otherStudent: "00000000-0000-4000-8000-000000000004",
  otherMentor: "00000000-0000-4000-8000-000000000005",
  studentProfile: "00000000-0000-4000-8000-000000000012",
  mentorProfile: "00000000-0000-4000-8000-000000000013",
  otherStudentProfile: "00000000-0000-4000-8000-000000000014",
  otherMentorProfile: "00000000-0000-4000-8000-000000000015",
  stack: "00000000-0000-4000-8000-000000000010",
  pendingSubmission: "00000000-0000-4000-8000-000000000020",
  assignedSubmission: "00000000-0000-4000-8000-000000000021",
  otherSubmission: "00000000-0000-4000-8000-000000000022",
} as const;

export const E2E_USERS = {
  admin: { email: "admin@e2e.test", firstName: "Ada", lastName: "Admin" },
  student: {
    email: "student@e2e.test",
    firstName: "Sita",
    lastName: "Student",
    github: "seedstudent",
  },
  mentor: {
    email: "mentor@e2e.test",
    firstName: "Mina",
    lastName: "Mentor",
    github: "seedmentor",
  },
  otherStudent: {
    email: "other-student@e2e.test",
    firstName: "Other",
    lastName: "Student",
    github: "seedotherstudent",
  },
  otherMentor: {
    email: "other-mentor@e2e.test",
    firstName: "Omar",
    lastName: "Mentor",
    github: "seedothermentor",
  },
} as const;
