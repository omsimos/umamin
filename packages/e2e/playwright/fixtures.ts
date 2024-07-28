import { test as baseTest, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export * from "@playwright/test";
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [
    async ({ browser }, use) => {
      // Use parallelIndex as a unique identifier for each worker.
      const id = test.info().parallelIndex;

      const username = `test_${nanoid(5)}`;
      const password = "strong_password";

      const fileName = path.resolve(
        test.info().project.outputDir,
        `.auth/${id}.json`
      );

      if (fs.existsSync(fileName)) {
        // Reuse existing authentication state if any.
        await use(fileName);
        return;
      }

      // Important: make sure we authenticate in a clean environment by unsetting storage state.
      const page = await browser.newPage({ storageState: undefined });

      await page.goto("http://localhost:3000/");
      await page.getByRole("link", { name: "Continue" }).click();
      await expect(page).toHaveTitle(/Umamin — Register/);
      await expect(
        page.getByRole("heading", { name: "Umamin Account" })
      ).toBeVisible();

      await page.getByLabel("Username").fill(username);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm Password").fill(password);
      await page.getByRole("button", { name: "Create an account" }).click();

      await page.waitForURL("**/inbox");
      await expect(page.getByTestId("username")).toBeVisible();

      // End of authentication steps.
      await page.context().storageState({ path: fileName });
      await page.close();
      await use(fileName);
    },
    { scope: "worker" },
  ],
});
