import { test, expect } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const EMAIL = process.env.E2E_EMAIL || "";
const PASSWORD = process.env.E2E_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test.describe("Saved search matches", () => {
  test("check matches routes to properties", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved search checks.");
    test.skip(!HAS_CREDS, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/(dashboard|tenant|host)/, { timeout: 15_000 });

    await page.goto("/dashboard/saved-searches");
    const checkButtons = page.getByRole("button", { name: /check matches/i });
    if ((await checkButtons.count()) === 0) {
      test.skip(true, "No saved searches available for this account.");
    }

    await checkButtons.first().click();
    await page.waitForURL(/\/properties\?(.+&)?savedSearchId=/, { timeout: 15_000 });
    await expect(page.getByText(/Matches for/i)).toBeVisible();
  });
});
