import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin|tenant|host/, { timeout: 20_000 });
}

test("referral program enable toggle persists after save and reload", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin creds missing.");

  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/settings/referrals");

  const toggleButton = page
    .getByRole("button", { name: /Pause program|Enable program/i })
    .first();
  const initialLabel = (await toggleButton.textContent()) ?? "";
  const shouldEnable = /Enable program/i.test(initialLabel);

  await toggleButton.click();
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await expect(page.getByText(/Referral settings saved\./i)).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();

  if (shouldEnable) {
    await expect(page.getByRole("button", { name: /Pause program/i }).first()).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: /Enable program/i }).first()).toBeVisible();
  }

  // Cleanup: restore original toggle state.
  await page
    .getByRole("button", { name: /Pause program|Enable program/i })
    .first()
    .click();
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await expect(page.getByText(/Referral settings saved\./i)).toBeVisible({
    timeout: 15_000,
  });
});
