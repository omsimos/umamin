import { test, expect } from "../playwright/fixtures.js";

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "parallel" });

test.afterEach(async ({ page }) => {
  await page.waitForURL("**/login");
  await expect(page).toHaveTitle(/Umamin — Login/);
  await expect(
    page.getByRole("heading", { name: "Umamin Account" })
  ).toBeVisible();
});

test("should redirect unauthenticated users from inbox", async ({ page }) => {
  await page.goto("/inbox");
});

test("should redirect unauthenticated users from settings", async ({
  page,
}) => {
  await page.goto("/settings");
});
