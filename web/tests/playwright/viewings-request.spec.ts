import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL || "";
const PASSWORD = process.env.E2E_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test.describe("Viewing requests", () => {
  test("tenant can request a viewing and see it in list", async ({ page }) => {
    test.skip(!HAS_CREDS, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/properties");
    const empty = page.getByTestId("properties-empty-state");
    if (await empty.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(empty).toBeVisible();
      return;
    }

    const firstCardLink = page.locator('[data-testid="property-card"] a').first();
    await expect(firstCardLink).toBeVisible({ timeout: 15_000 });
    await firstCardLink.click();
    await page.waitForURL("**/properties/**", { timeout: 10_000 });

    const requestBtn = page.getByTestId("request-viewing-button");
    if (await requestBtn.isDisabled()) {
      await page.goto("/tenant/viewings");
      await expect(page.getByTestId("viewing-row").first()).toBeVisible({ timeout: 10_000 });
      return;
    }

    await requestBtn.click();
    const datetimeInputs = page.locator('input[type="datetime-local"]');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(10, 0, 0, 0);
    const isoLocal = tomorrow.toISOString().slice(0, 16);
    await datetimeInputs.first().fill(isoLocal);

    await page.getByTestId("submit-viewing-button").click();
    await expect(requestBtn).toHaveText(/requested/i, { timeout: 10_000 });

    await page.goto("/tenant/viewings");
    await expect(page.getByTestId("viewing-row").first()).toBeVisible({ timeout: 10_000 });
  });
});
