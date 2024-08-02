import { test, expect } from "../playwright/fixtures.js";

test.describe.configure({ mode: "parallel" });

test("should be authenticated", async ({ page }) => {
  await page.goto("/login");
  await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);
});

test.describe("Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
});
