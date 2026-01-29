import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("admin can access dashboard listing creation without support redirect (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL/PASSWORD to run admin dashboard smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/dashboard/properties/new");
  await expect(page).not.toHaveURL(/\/admin\/support/);
  await expect(page.getByRole("heading", { name: /create listing/i })).toBeVisible({ timeout: 10000 });
});

test("admin dashboard nav does not redirect to support (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL/PASSWORD to run admin dashboard smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.getByRole("link", { name: /^dashboard$/i }).click();
  await expect(page).not.toHaveURL(/\/admin\/support/);
  await expect(page).toHaveURL(/\/admin(\/)?$/);
});
