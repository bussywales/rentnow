import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/tenant\/home/, { timeout: 15_000 });
}

test("tenant lands on discovery home and can open a listing", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping tenant home flow.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);

  await expect(page.getByRole("heading", { name: /find your next home/i })).toBeVisible();

  const featuredSection = page.getByTestId("tenant-home-featured");
  if ((await featuredSection.count()) > 0) {
    const featuredCards = featuredSection.getByTestId("tenant-home-card");
    const featuredCount = await featuredCards.count();
    expect(featuredCount).toBeGreaterThan(0);
  } else {
    await expect(page.getByText(/Featured homes/i)).toHaveCount(0);
  }

  const cards = page.getByTestId("tenant-home-card");
  if (!(await cards.first().isVisible().catch(() => false))) {
    test.skip(true, "No listings available on tenant home to validate navigation.");
  }

  await cards.first().click();
  await page.waitForURL(/\/properties\//, { timeout: 15_000 });

  await page.getByRole("link", { name: /^Dashboard$/i }).click();
  await page.waitForURL(/\/tenant$/, { timeout: 15_000 });
});
