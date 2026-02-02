import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("admin users page search and drawer (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL/PASSWORD to run admin users smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/admin/users");
  await expect(page.getByTestId("admin-users-table")).toBeVisible();

  const firstRow = page.getByTestId("admin-user-row").first();
  const rowCount = await firstRow.count();
  test.skip(rowCount === 0, "No users found; skipping drawer smoke.");

  const rowEmail = (await firstRow.getAttribute("data-email")) || "";
  const rowId = (await firstRow.getAttribute("data-user-id")) || "";
  const searchValue = rowEmail.trim()
    ? rowEmail.trim().slice(0, 6)
    : rowId.slice(0, 6);

  if (searchValue) {
    await page.getByTestId("admin-users-search").fill(searchValue);
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(searchValue)}`), {
      timeout: 10_000,
    });
  }

  await firstRow.click();
  await expect(page.getByTestId("admin-user-drawer")).toBeVisible();
  await expect(page.getByText(/Role management/i)).toBeVisible();
  await expect(page.getByTestId("admin-user-role-select")).toBeVisible();
  await expect(page.getByTestId("admin-user-plan-save")).toBeVisible();
});
