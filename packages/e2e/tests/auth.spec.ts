import { nanoid } from "nanoid";
import { test, expect } from "@playwright/test";

const username = `test_${nanoid(5)}`;
const password = "password";

test("should redirect unauthenticated users", async ({ page }) => {
  await page.goto("/inbox");
  await page.waitForURL("**/login");
  await expect(page).toHaveTitle(/Umamin — Login/);

  await page.goto("/settings");
  await page.waitForURL("**/login");
  await expect(page).toHaveTitle(/Umamin — Login/);
});

test.describe.serial("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  test("can register", async ({ page }) => {
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveTitle(/Umamin — Register/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);
    await expect(page.getByTestId("username")).toBeVisible();
  });

  test("can login", async ({ page }) => {
    await page.getByTestId("nav-login-btn").click();
    await page.waitForURL("**/login");
    await expect(page).toHaveTitle(/Umamin — Login/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);
    await expect(page.getByTestId("username")).toBeVisible();

    // go to settings and logout
    await page.getByTestId("nav-settings-btn").click();
    await page.waitForURL("**/settings");
    await expect(page).toHaveTitle(/Umamin — Settings/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login");
    await expect(page).toHaveTitle(/Umamin — Login/);
    await expect(
      page.getByRole("heading", { name: "Umamin Account" })
    ).toBeVisible();
  });
});
