import { expect, test } from "@playwright/test";

import {
  E2E_IDS,
  E2E_PASSWORD,
  E2E_STACK_NAME,
  E2E_USERS,
} from "../src/test/constants";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("student registration creates an account and opens the student workspace", async ({ page }) => {
  await page.goto("/register/student");
  await page.getByLabel("First name").fill("Regina");
  await page.getByLabel("Last name").fill("Student");
  await page.getByLabel("Email").fill("registered-student@e2e.test");
  await page.getByLabel("NIAT ID").fill("E2E-NIAT-REG");
  await page.getByLabel("Batch").fill("E2E Batch");
  await page.getByLabel("University name").fill("E2E University");
  await page.getByLabel("GitHub username").fill("registeredstudent");
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Confirm password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create student account" }).click();

  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Regina Student" })).toBeVisible();
});

test("student login opens the seeded dashboard", async ({ page }) => {
  await login(page, E2E_USERS.student.email);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Sita Student" })).toBeVisible();
  await expect(page.getByRole("link", { name: "seedstudent", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "seedstudent/demo" }).first()).toBeVisible();
});

test("student pull request submission rejects an invalid URL, accepts a fixture URL, and rejects a duplicate", async ({
  page,
}) => {
  await login(page, E2E_USERS.student.email);
  await page.goto("/student/submissions");

  await page.getByLabel("Tech stack").selectOption({ label: E2E_STACK_NAME });
  await page.getByLabel("GitHub pull request URL").fill("https://example.com/owner/repo/pull/1");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByText("Enter a GitHub pull request URL, such as https://github.com/owner/repo/pull/1."),
  ).toBeVisible();

  await page.getByLabel("Tech stack").selectOption({ label: E2E_STACK_NAME });
  await page.getByLabel("GitHub pull request URL").fill("https://github.com/seedstudent/demo/pull/2");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("The pull request is in the admin queue with status Pending.")).toBeVisible();
  await expect(page.getByText("seedstudent/demo").first()).toBeVisible();

  await page.getByLabel("Tech stack").selectOption({ label: E2E_STACK_NAME });
  await page.getByLabel("GitHub pull request URL").fill("https://github.com/seedstudent/demo/pull/2");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("This pull request has already been submitted.")).toBeVisible();
});

test("admin login assigns a mentor to a pending submission", async ({ page }) => {
  await login(page, E2E_USERS.admin.email);
  await page.goto(`/admin/submissions/${E2E_IDS.pendingSubmission}`);
  await page.getByLabel("Mentor").selectOption({ label: "Mina Mentor · 1 active assignment" });
  await page.getByRole("button", { name: "Assign mentor" }).click();
  await expect(page.getByText("The mentor assignment was saved.")).toBeVisible();
});

test("mentor login reviews an assigned pull request", async ({ page }) => {
  await login(page, E2E_USERS.mentor.email);
  await page.goto(`/mentor/pull-requests/${E2E_IDS.assignedSubmission}`);
  await page.getByRole("button", { name: "Mark in review" }).click();
  await expect(page.getByText("The submission is now in review.")).toBeVisible();
  await page.getByLabel("Review comment").fill("The change is ready.");
  await page.getByRole("button", { name: "Approve review" }).click();
  await expect(page.getByText("The review was saved and the student was notified.")).toBeVisible();
  await expect(page.getByText("The change is ready.")).toBeVisible();
});

test("student and mentor exchange a conversation", async ({ browser }) => {
  const studentContext = await browser.newContext();
  const mentorContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const mentorPage = await mentorContext.newPage();

  await login(studentPage, E2E_USERS.student.email);
  await studentPage.goto(`/student/chat/${E2E_IDS.assignedSubmission}`);
  await studentPage.getByRole("textbox", { name: "Message" }).fill("Student fixture note.");
  await studentPage.getByRole("button", { name: "Send message" }).click();
  await expect(studentPage.getByText("The message was sent.")).toBeVisible();
  await expect(studentPage.getByText("Student fixture note.")).toBeVisible();

  await login(mentorPage, E2E_USERS.mentor.email);
  await mentorPage.goto(`/mentor/chat/${E2E_IDS.assignedSubmission}`);
  await expect(mentorPage.getByText("Student fixture note.")).toBeVisible();
  await mentorPage.getByRole("textbox", { name: "Message" }).fill("Mentor fixture note.");
  await mentorPage.getByRole("button", { name: "Send message" }).click();
  await expect(mentorPage.getByText("The message was sent.")).toBeVisible();

  await studentPage.goto(`/student/chat/${E2E_IDS.assignedSubmission}`);
  await expect(studentPage.getByText("Mentor fixture note.")).toBeVisible();
  const html = await studentPage.content();
  expect(html).not.toContain("v1.");
  expect(html.toLowerCase()).not.toContain("end-to-end");

  await studentContext.close();
  await mentorContext.close();
});
