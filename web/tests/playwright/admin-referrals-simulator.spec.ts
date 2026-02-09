import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL;
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");

  const emailLabel = page.getByLabel(/email/i);
  if (await emailLabel.isVisible().catch(() => false)) {
    await emailLabel.fill(email);
  } else {
    await page.getByPlaceholder("you@email.com").fill(email);
  }

  const passwordLabel = page.getByLabel(/password/i);
  if (await passwordLabel.isVisible().catch(() => false)) {
    await passwordLabel.fill(password);
  } else {
    await page.getByPlaceholder("Password").fill(password);
  }

  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin|tenant|host/, { timeout: 20_000 });
}

test("admin referral simulator loads (skip-safe)", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin creds missing; skipping simulator smoke.");

  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/referrals/simulator");

  await expect(page.getByRole("heading", { name: /Referral simulator/i })).toBeVisible();
  await expect(page.getByText(/does not write to the database/i)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/referrals\/simulator/);
});

test("non-admin cannot open referral simulator (skip-safe)", async ({ page }) => {
  test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Agent creds missing; skipping admin-only gate check.");

  await login(page, AGENT_EMAIL!, AGENT_PASSWORD!);
  await page.goto("/admin/referrals/simulator");

  await expect(page).toHaveURL(/forbidden|auth\/required|auth\/login/);
});
