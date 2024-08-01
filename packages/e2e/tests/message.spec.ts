import { nanoid } from "nanoid";
import { test, expect } from "../playwright/fixtures.js";

const content = `this is a test message ${nanoid()}`;

test.describe("Sender", () => {
  test("can send a message", async ({ page }) => {
    await page.goto("/to/test_user");
    await expect(page.getByText("test_user")).toBeVisible();

    await page.getByPlaceholder("Type your message...").fill(content);
    await page.getByTestId("send-msg-btn").click();
    await expect(page.getByTestId("msg-content")).toHaveText(content);
  });
});

test.describe("Receiver", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("should receive a new message", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Umamin — Login/);
    await expect(
      page.getByRole("heading", { name: "Umamin Account" })
    ).toBeVisible();

    await page.getByLabel("Username").fill("test_user");
    await page.getByLabel("Password").fill("strong_password");
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/inbox");
    await expect(page.getByTestId("username")).toHaveText("@test_user");
    await expect(page.getByText(content)).toBeVisible();
  });
});
