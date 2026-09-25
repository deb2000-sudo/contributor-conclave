import { mentorAssignmentService } from "@/lib/admin/mentor-assignment-service";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { messagingService } from "@/lib/messaging/service";

import {
  E2E_DOMAIN,
  E2E_IDS,
  E2E_PASSWORD,
  E2E_PRIVATE_MESSAGE,
  E2E_STACK_NAME,
  E2E_STACK_PREFIX,
  E2E_USERS,
} from "./constants";
import { insertTechStack, insertUser, removeFixtures } from "./fixtures";

async function requireAssign(adminId: string, submissionId: string, mentorProfileId: string) {
  const result = await mentorAssignmentService.assign(adminId, submissionId, mentorProfileId);
  if (!result.ok) {
    throw new Error(`Seed assignment failed: ${result.message}`);
  }
}

/** Resets the end-to-end domain and recreates the same users, submissions, and conversation. */
export async function seedE2E() {
  await removeFixtures(E2E_DOMAIN, E2E_STACK_PREFIX);
  const passwordHash = await hashPassword(E2E_PASSWORD);

  await insertTechStack(E2E_STACK_NAME, E2E_IDS.stack);
  await insertUser({
    id: E2E_IDS.admin,
    role: "ADMIN",
    email: E2E_USERS.admin.email,
    firstName: E2E_USERS.admin.firstName,
    lastName: E2E_USERS.admin.lastName,
    passwordHash,
  });
  await insertUser({
    id: E2E_IDS.student,
    profileId: E2E_IDS.studentProfile,
    role: "STUDENT",
    email: E2E_USERS.student.email,
    firstName: E2E_USERS.student.firstName,
    lastName: E2E_USERS.student.lastName,
    githubUsername: E2E_USERS.student.github,
    niatId: "E2E-NIAT-1",
    batch: "E2E Batch",
    universityName: "E2E University",
    passwordHash,
  });
  await insertUser({
    id: E2E_IDS.otherStudent,
    profileId: E2E_IDS.otherStudentProfile,
    role: "STUDENT",
    email: E2E_USERS.otherStudent.email,
    firstName: E2E_USERS.otherStudent.firstName,
    lastName: E2E_USERS.otherStudent.lastName,
    githubUsername: E2E_USERS.otherStudent.github,
    niatId: "E2E-NIAT-2",
    batch: "E2E Batch",
    universityName: "E2E University",
    passwordHash,
  });
  await insertUser({
    id: E2E_IDS.mentor,
    profileId: E2E_IDS.mentorProfile,
    role: "MENTOR",
    email: E2E_USERS.mentor.email,
    firstName: E2E_USERS.mentor.firstName,
    lastName: E2E_USERS.mentor.lastName,
    githubUsername: E2E_USERS.mentor.github,
    employeeId: "E2E-EMP-1",
    approvalStatus: "APPROVED",
    passwordHash,
  });
  await insertUser({
    id: E2E_IDS.otherMentor,
    profileId: E2E_IDS.otherMentorProfile,
    role: "MENTOR",
    email: E2E_USERS.otherMentor.email,
    firstName: E2E_USERS.otherMentor.firstName,
    lastName: E2E_USERS.otherMentor.lastName,
    githubUsername: E2E_USERS.otherMentor.github,
    employeeId: "E2E-EMP-2",
    approvalStatus: "APPROVED",
    passwordHash,
  });

  await db.mentorTechStack.createMany({
    data: [
      { mentorId: E2E_IDS.mentorProfile, techStackId: E2E_IDS.stack },
      { mentorId: E2E_IDS.otherMentorProfile, techStackId: E2E_IDS.stack },
    ],
  });

  await db.pRSubmission.createMany({
    data: [
      {
        id: E2E_IDS.pendingSubmission,
        studentId: E2E_IDS.studentProfile,
        githubPrUrl: "https://github.com/seedstudent/demo/pull/1",
        repository: "seedstudent/demo",
        techStackId: E2E_IDS.stack,
        status: "PENDING",
      },
      {
        id: E2E_IDS.assignedSubmission,
        studentId: E2E_IDS.studentProfile,
        githubPrUrl: "https://github.com/seedstudent/demo/pull/3",
        repository: "seedstudent/demo",
        techStackId: E2E_IDS.stack,
        status: "PENDING",
      },
      {
        id: E2E_IDS.otherSubmission,
        studentId: E2E_IDS.otherStudentProfile,
        githubPrUrl: "https://github.com/seedotherstudent/demo/pull/1",
        repository: "hidden/secret-repo",
        techStackId: E2E_IDS.stack,
        status: "PENDING",
      },
    ],
  });

  await requireAssign(E2E_IDS.admin, E2E_IDS.assignedSubmission, E2E_IDS.mentorProfile);
  await requireAssign(E2E_IDS.admin, E2E_IDS.otherSubmission, E2E_IDS.otherMentorProfile);

  const sent = await messagingService.send(
    E2E_IDS.otherStudent,
    E2E_IDS.otherSubmission,
    E2E_PRIVATE_MESSAGE,
  );
  if (!sent.ok) {
    throw new Error(`Seed message failed: ${sent.message}`);
  }
}
