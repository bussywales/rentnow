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

test("admin can toggle agent storefronts flag", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Admin creds missing; skipping settings toggle.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/admin/settings");
  const setting = page.getByTestId("admin-setting-agent_storefronts_enabled");
  await expect(setting).toBeVisible();

  const status = setting.getByText(/Enabled|Disabled/);
  const initial = (await status.textContent())?.toLowerCase() ?? "";
  const toggleButton = setting.getByRole("button", { name: /enable|disable/i });

  await toggleButton.click();
  await expect(setting.getByText(/Updated\./i)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(setting).toBeVisible();
  const next = (await status.textContent())?.toLowerCase() ?? "";
  expect(next).not.toEqual(initial);

  // revert to original state
  await toggleButton.click();
  await expect(setting.getByText(/Updated\./i)).toBeVisible({ timeout: 10_000 });
});
