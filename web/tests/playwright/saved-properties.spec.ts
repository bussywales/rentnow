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
  await page.waitForURL(/\/(dashboard|tenant\/home|host|favourites)/, { timeout: 15_000 });
}

test("tenant can save and revisit a listing", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved flow.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/tenant/home");

  const card = page.getByTestId("tenant-home-card").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "No listings available on tenant home to save.");
  }

  const title = (await card.getByRole("heading").first().textContent())?.trim() || "";
  const saveToggle = card.getByTestId("save-toggle");
  await saveToggle.click();
  await expect(saveToggle).toHaveAttribute("aria-pressed", "true");

  await page.goto("/tenant/saved");
  if (title) {
    await expect(page.getByText(title)).toBeVisible();
  }

  const savedToggle = page.getByTestId("save-toggle").first();
  await savedToggle.click();
  await expect(savedToggle).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  if (title) {
    await expect(page.getByText(title)).toHaveCount(0);
  }
});

test("save from property detail redirects to login when logged out", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved redirect flow.");

  await page.goto("/properties");
  const card = page.getByTestId("property-card").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "No listings available to open property detail.");
  }

  await card.getByRole("link").first().click();
  await page.waitForURL("**/properties/**", { timeout: 10_000 });

  await page.getByRole("button", { name: /save property|save listing|saved listing/i }).click();
  await page.waitForURL(/auth\/login/, { timeout: 10_000 });
  await expect(page.url()).toContain("redirect=");
});
