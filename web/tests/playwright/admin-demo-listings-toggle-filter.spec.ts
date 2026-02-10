import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("admin can use demo filter pills (skip-safe)", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Admin creds missing; skipping demo filter UI.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin/);

  await page.goto("/admin/listings");
  await expect(page.getByRole("heading", { name: /listings registry/i })).toBeVisible();

  const demoFilters = page.getByTestId("admin-demo-filters");
  await expect(demoFilters).toBeVisible();

  await page.getByTestId("admin-demo-filter-true").click();
  await expect(page).toHaveURL(/demo=true/);
  await expect(page.getByTestId("admin-demo-filter-helper")).toContainText(/Showing demo listings only/i);

  await page.getByTestId("admin-demo-filter-false").click();
  await expect(page).toHaveURL(/demo=false/);
  await expect(page.getByTestId("admin-demo-filter-helper")).toContainText(/Hiding demo listings/i);

  await page.getByTestId("admin-demo-filter-all").click();
  await expect(page).not.toHaveURL(/demo=(true|false)/);
});

