import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("admin listings filters apply and update URL (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL/PASSWORD to run admin listings filter smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/admin/listings?status=pending");
  await expect(page.getByRole("heading", { name: /listings registry/i })).toBeVisible();

  await expect(page).toHaveURL(/status=pending/);

  const summary = page.getByTestId("admin-listings-applied-filters");
  await expect(summary).toBeVisible();

  const emptyState = page.getByText(/no listings match your filters/i);
  if (await emptyState.isVisible()) {
    await expect(emptyState).toBeVisible();
  } else {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const statusCells = page.locator("tbody tr td:nth-child(3) span");
    const statusCount = await statusCells.count();
    for (let i = 0; i < statusCount; i += 1) {
      await expect(statusCells.nth(i)).toContainText(/pending/i);
    }
  }
});
