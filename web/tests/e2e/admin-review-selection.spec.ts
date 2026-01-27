import { test, expect } from "@playwright/test";

test("admin review desk allows selecting a listing and shows panel", async ({ page }) => {
  await page.goto("/admin/review?view=pending");

  const firstRow = page.locator("div.divide-y button").first();

  const hasRows = await firstRow.isVisible().catch(() => false);
  test.skip(!hasRows, "No pending listings available in test environment");

  await firstRow.click();
  await expect(page.getByText("Overview")).toBeVisible();
  await expect(page.getByText("Media")).toBeVisible();
});
