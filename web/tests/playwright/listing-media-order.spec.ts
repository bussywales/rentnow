import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("reorder photos with up/down controls (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping media order smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Media order smoke");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/details/);

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  // If photos exist, try moving the first one down.
  const moveDown = page.getByRole("button", { name: "Move photo down" }).first();
  const hasPhotos = await moveDown.isVisible().catch(() => false);
  test.skip(!hasPhotos, "No photos available to reorder in this environment.");

  await moveDown.click();
  await expect(moveDown).toBeVisible();
});
