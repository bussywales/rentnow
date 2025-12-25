import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test.describe("Smoke checks", () => {
  test("properties list and detail load", async ({ page }) => {
    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();

    const propertyLink = page
      .locator("a")
      .filter({ hasText: /ngn|usd|egp|zar|kes/i })
      .first();
    await expect(propertyLink).toBeVisible({ timeout: 15_000 });
    await propertyLink.click();

    await page.waitForURL("**/properties/**", { timeout: 10_000 });
    await expect(page.getByText(/Request a viewing/i)).toBeVisible();
  });

  test("login persists on dashboard reload", async ({ page }) => {
    test.skip(!HAS_CREDS, "Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD to run auth tests.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page.getByText(/My properties/i)).toBeVisible();

    await page.reload();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    await expect(page.getByText(/My properties/i)).toBeVisible();
  });
});
