import { expect, test } from "@playwright/test";

import { E2E_IDS, E2E_PRIVATE_MESSAGE, E2E_USERS } from "../src/test/constants";
import { expectWorkspaceDenied, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("unauthenticated workspace routes redirect to login", async ({ page }) => {
  for (const path of ["/student", "/mentor", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("a student cannot open admin, mentor, or another student's conversation", async ({ page }) => {
  await login(page, E2E_USERS.student.email);

  await page.goto("/admin");
  await expectWorkspaceDenied(page, E2E_USERS.otherStudent.email);

  await page.goto("/mentor");
  await expectWorkspaceDenied(page, E2E_USERS.otherStudent.email);
  await expect(page.getByRole("button", { name: "Mark in review" })).toHaveCount(0);

  await page.goto(`/student/chat/${E2E_IDS.otherSubmission}`);
  await expect(page.getByText("Conversation unavailable")).toBeVisible();
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);
  await expect(page.getByText(E2E_USERS.otherStudent.email)).toHaveCount(0);
});

test("a mentor cannot open admin or another mentor's student", async ({ page }) => {
  await login(page, E2E_USERS.mentor.email);

  await page.goto("/admin");
  await expectWorkspaceDenied(page, E2E_USERS.otherStudent.email);

  await page.goto(`/mentor/students/${E2E_IDS.otherStudent}`);
  await expect(page.getByText("Student unavailable")).toBeVisible();
  await expect(page.getByText(E2E_USERS.otherStudent.email)).toHaveCount(0);
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);

  await page.goto(`/mentor/pull-requests/${E2E_IDS.otherSubmission}`);
  await expect(page.getByText("Pull request unavailable")).toBeVisible();
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);
});

test("a manipulated student conversation id does not reveal another user's data", async ({ page }) => {
  await login(page, E2E_USERS.student.email);
  await page.goto("/student/chat/not-a-uuid");
  await expect(page.getByText("Conversation unavailable")).toBeVisible();
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);
});

test("a manipulated mentor pull request id does not reveal another user's data", async ({ page }) => {
  await login(page, E2E_USERS.mentor.email);
  await page.goto("/mentor/pull-requests/not-a-uuid");
  await expect(page.getByText("Pull request unavailable")).toBeVisible();
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);
});

test("a manipulated admin submission id does not reveal another user's data", async ({ page }) => {
  await login(page, E2E_USERS.admin.email);
  await page.goto("/admin/submissions/not-a-uuid");
  await expect(page.getByText("Submission unavailable")).toBeVisible();
  await expect(page.getByText(E2E_PRIVATE_MESSAGE)).toHaveCount(0);
  await expect(page.getByText(E2E_USERS.otherStudent.email)).toHaveCount(0);
});
