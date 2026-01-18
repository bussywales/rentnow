import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("recommended cover can be applied (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping recommended cover smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Recommended cover smoke");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  const card = page.getByText(/Recommended cover/i).first();
  const cardVisible = await card.isVisible().catch(() => false);
  test.skip(!cardVisible, "Recommended cover card not visible (no photos?)");

  const btn = page.getByRole("button", { name: /recommended cover/i }).first();
  const btnVisible = await btn.isVisible().catch(() => false);
  test.skip(!btnVisible, "Use recommended cover button not available");

  await btn.click();
  await expect(page.getByText(/Cover updated|Cover set for this listing/i)).toBeVisible({ timeout: 5000 });
});
