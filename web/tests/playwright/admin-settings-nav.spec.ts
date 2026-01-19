import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("admin nav exposes settings (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Admin creds missing; skipping settings nav smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/");
  const settingsLink = page.getByRole("link", { name: /settings/i }).first();
  await expect(settingsLink).toBeVisible();
  await settingsLink.click();
  await expect(page).toHaveURL(/\/admin\/settings/);
  await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
});
