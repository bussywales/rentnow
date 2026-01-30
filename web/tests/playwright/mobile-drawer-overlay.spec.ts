import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("mobile drawer overlays content (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL/PASSWORD to run mobile drawer overlay test.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/properties");
  await page.getByRole("button", { name: /open menu/i }).click();

  const backdrop = page.getByTestId("mobile-nav-backdrop");
  const drawer = page.getByTestId("mobile-nav-drawer");
  await expect(backdrop).toBeVisible();
  await expect(drawer).toBeVisible();

  const scrollPosition = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);
  const afterScroll = await page.evaluate(() => window.scrollY);
  expect(afterScroll).toBe(scrollPosition);

  await backdrop.click();
  await expect(drawer).toBeHidden();
});
