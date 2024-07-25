import { nanoid } from "nanoid";
import { test, expect } from "@playwright/test";

const username = `test_${nanoid(5)}`;
const password = "password";

test.describe("Authentication", () => {
  test.afterEach(async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveTitle(/Umamin — Settings/);
    await page.getByTestId("logout").click();
  });

  test("can register", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveTitle(/Umamin — Register/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.waitForURL("**/inbox");
    await expect(page).toHaveTitle(/Umamin — Inbox/);
  });

  test("can login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Umamin — Login/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();
  });
});
