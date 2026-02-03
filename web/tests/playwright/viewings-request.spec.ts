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
    await page.waitForURL(/\/(dashboard|tenant\/home|host)/, { timeout: 15_000 });

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
    await page.getByTestId("slot-duration-60").click();
    const slotOptions = page.getByTestId("slot-option");
    await expect(slotOptions.first()).toBeVisible({ timeout: 5_000 });
    await slotOptions.nth(0).click();
    await slotOptions.nth(1).click();

    await page.getByTestId("submit-viewing-button").click();
    await expect(requestBtn).toHaveText(/requested/i, { timeout: 10_000 });

    await page.goto("/tenant/viewings");
    await expect(page.getByTestId("viewing-row").first()).toBeVisible({ timeout: 10_000 });
  });
});
