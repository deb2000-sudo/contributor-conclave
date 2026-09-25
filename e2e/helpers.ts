import { expect, type Page } from "@playwright/test";

import { E2E_PASSWORD } from "../src/test/constants";

export async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(student|mentor|admin)(?:\/|$)/);
}

export async function expectWorkspaceDenied(page: Page, secret: string) {
  await expect(
    page.getByRole("heading", { name: /Access denied|This page could not be loaded/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign mentor" })).toHaveCount(0);
  await expect(page.getByText(secret)).toHaveCount(0);
}
