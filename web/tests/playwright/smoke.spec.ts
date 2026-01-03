import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;
const DEV_MOCKS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true";
const HAS_OPENAI = !!process.env.OPENAI_API_KEY;
const HAS_SUPABASE_ENV =
  (!!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (!!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

test.describe("Smoke checks", () => {
  test("properties list and detail load", async ({ page }) => {
    await page.goto("/properties");
    const expectListings = HAS_SUPABASE_ENV || DEV_MOCKS;

    if (!expectListings) {
      await expect(
        page.getByRole("heading", { name: /no properties found/i })
      ).toBeVisible();
      await expect(page.getByText(/diagnostics/i)).toBeVisible();
      await expect(
        page.locator("a").filter({ hasText: /ngn|usd|egp|zar|kes/i })
      ).toHaveCount(0);
      return;
    }

    const apiRes = await page.request.get("/api/properties");
    if (!apiRes.ok()) {
      await expect(
        page.getByRole("heading", { name: /no properties found/i })
      ).toBeVisible();
      return;
    }

    const apiJson = await apiRes.json().catch(() => ({}));
    const hasListings = Array.isArray(apiJson?.properties) && apiJson.properties.length > 0;
    if (!hasListings) {
      await expect(
        page.getByRole("heading", { name: /no properties found/i })
      ).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();

    const propertyLink = page
      .locator("a")
      .filter({ hasText: /ngn|usd|egp|zar|kes/i })
      .first();
    await expect(propertyLink).toBeVisible({ timeout: 15_000 });
    await propertyLink.click();

    await page.waitForURL("**/properties/**", { timeout: 10_000 });
    const notFound = page.getByRole("heading", { name: /listing not found/i });
    if (await notFound.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return;
    }
    await expect(page.getByText(/Request a viewing/i)).toBeVisible();
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
