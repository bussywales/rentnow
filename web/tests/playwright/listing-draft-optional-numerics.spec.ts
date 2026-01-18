import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("draft save allows empty optional numerics (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping draft numeric smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/i);

  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Draft smoke test");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  // Leave size/deposit empty and attempt to advance
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/details/);
});
