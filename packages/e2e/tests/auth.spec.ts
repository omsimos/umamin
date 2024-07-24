import { nanoid } from "nanoid";
import { test, expect } from "@playwright/test";

const username = `test_${nanoid(5)}`;
const password = "password";

test.describe("Authentication", () => {
  test("can create an account", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveTitle(/Umamin — Register/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);
  });

  test("can login and logout", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Umamin — Login/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign Out" }).click();
  });
});
