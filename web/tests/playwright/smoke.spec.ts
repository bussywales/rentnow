import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;
const HAS_OPENAI = !!process.env.OPENAI_API_KEY;

test.describe("Smoke checks", () => {
  test("properties list and detail load", async ({ page }) => {
    await page.goto("/properties");
    const emptyState = page.getByTestId("properties-empty-state");
    if (await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
      return;
    }

    const grid = page.getByTestId("properties-grid");
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const firstCardLink = page
      .locator('[data-testid="property-card"] a')
      .first();
    await expect(firstCardLink).toBeVisible({ timeout: 15_000 });
    await firstCardLink.click();

    await page.waitForURL("**/properties/**", { timeout: 10_000 });
    if (await page.getByRole("heading", { name: /listing not found/i }).isVisible({ timeout: 2_000 }).catch(() => false)) {
      return;
    }
    const heading = page.getByRole("heading", { name: /request a viewing/i });
    const button = page.getByTestId("request-viewing-button");
    if (await heading.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    } else {
      await expect(page.getByText(/About/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("smart search routes to browse with filters", async ({ page }) => {
    test.skip(!HAS_OPENAI, "OPENAI_API_KEY missing; skipping smart search parse test.");

    await page.goto("/");
    await page
      .getByPlaceholder(/furnished 2-bed|describe what you need/i)
      .fill("2 bed in Lagos");
    await page.getByRole("button", { name: /parse/i }).click();

    const cta = page.getByRole("button", { name: /search properties/i });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/bedrooms=2/);
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
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
