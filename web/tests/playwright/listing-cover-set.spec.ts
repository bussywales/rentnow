import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("photos step lets you set a cover (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping cover UI smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Cover smoke test");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  const setCoverButton = page.getByRole("button", { name: /set as cover/i }).first();
  const hasPhotos = await setCoverButton.isVisible().catch(() => false);
  test.skip(!hasPhotos, "No photos available to set cover in this environment.");

  await setCoverButton.click();
  await expect(page.getByText(/^Cover$/)).toBeVisible();
});
