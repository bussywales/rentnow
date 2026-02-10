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

test("admin can add a referral milestone", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin creds missing.");

  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/settings/referrals");

  const milestoneToggle = page.getByTestId("admin-referral-milestones-enabled-toggle");
  if (await milestoneToggle.isVisible().catch(() => false)) {
    if (!(await milestoneToggle.isChecked())) {
      await milestoneToggle.check();
    }
  }

  await expect(page.getByTestId("admin-referral-milestones-editor")).toBeVisible();

  const milestoneName = `Milestone ${Date.now()}`;
  const milestoneThreshold = String((Date.now() % 9000) + 1000);

  await page.getByTestId("admin-referral-milestone-create-name").fill(milestoneName);
  await page
    .getByTestId("admin-referral-milestone-create-threshold")
    .fill(milestoneThreshold);
  await page.getByTestId("admin-referral-milestone-create-bonus").fill("7");
  await page.getByTestId("admin-referral-milestone-create-submit").click();

  await expect(page.getByText(/Milestone added\./i)).toBeVisible({ timeout: 15_000 });

  const createdRow = page
    .locator('[data-testid^="admin-referral-milestone-row-"]')
    .filter({ hasText: milestoneName })
    .first();
  await expect(createdRow).toBeVisible();

  await createdRow.getByRole("button", { name: /delete/i }).click();
  await expect(page.getByText(/Milestone removed\./i)).toBeVisible({ timeout: 15_000 });
});
