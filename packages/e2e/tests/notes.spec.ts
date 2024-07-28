import { nanoid } from "nanoid";
import { test, expect } from "../playwright/fixtures.js";

test.describe.configure({ mode: "parallel" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-notes-btn").click();
  await page.waitForURL("**/notes");
  await expect(page).toHaveTitle(/Umamin — Notes/);
});

test("can update note", async ({ page }) => {
  const content = `this is a test note ${nanoid()}`;
  await page.getByPlaceholder("How's your day going?").fill(content);
  await page.getByTestId("share-note-btn").click();
  await expect(page.getByText(content)).toBeVisible();

  await page
    .locator("section")
    .getByRole("button", { name: "post menu" })
    .click();
  await page.getByRole("menuitem", { name: "Clear Note" }).click();
  await expect(page.getByText(content)).not.toBeVisible();
});

test("can reply to note", async ({ page }) => {
  const content = `this is a test note reply ${nanoid()}`;
  await page.getByTestId("note-reply-btn").first().click();
  await page.getByPlaceholder("Type your anonymous reply...").fill(content);
  await expect(page.getByText(content)).toBeVisible();
});
