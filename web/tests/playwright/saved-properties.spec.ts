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
  if (!(await page.getByText(title).first().isVisible().catch(() => false))) {
    const openCollection = page.getByRole("button", { name: /^open$/i }).first();
    if (await openCollection.isVisible().catch(() => false)) {
      await openCollection.click();
    }
  }
  if (title) {
    await expect(page.getByText(title)).toBeVisible();
  }

  const savedToggle = page.getByTestId("save-toggle").first();
  if (await savedToggle.isVisible().catch(() => false)) {
    await savedToggle.click();
    await expect(savedToggle).toHaveAttribute("aria-pressed", "false");
  } else {
    const removeButton = page.getByRole("button", { name: /remove from collection/i }).first();
    if (!(await removeButton.isVisible().catch(() => false))) {
      test.skip(true, "No remove action available in saved collection detail.");
    }
    await removeButton.click();
  }

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

  const detailLink = card.getByRole("link").first();
  const href = await detailLink.getAttribute("href");
  const fallbackPattern = /\/properties\/.+/;
  const targetPattern = href ? new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : fallbackPattern;

  await Promise.all([
    page.waitForURL(targetPattern, { timeout: 60_000 }),
    detailLink.click(),
  ]);
  await page.waitForLoadState("domcontentloaded");

  const saveButton = page.getByTestId("save-button");
  if (await saveButton.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await saveButton.click();
  } else {
    await page
      .getByRole("button", { name: /save property|save listing|saved listing/i })
      .click();
  }
  await page.waitForURL(/auth\/login/, { timeout: 10_000 });
  await expect(page.url()).toContain("redirect=");
});
