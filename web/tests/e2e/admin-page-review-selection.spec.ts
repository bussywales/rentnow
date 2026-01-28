import { test, expect } from "@playwright/test";

test("admin page embeds review drawer and opens on row click", async ({ page }) => {
  await page.goto("/admin");

  const firstRow = page.locator("button:has-text('Review')").first();
  const hasRows = await firstRow.isVisible().catch(() => false);
  test.skip(!hasRows, "No reviewable listings available in test environment");

  await firstRow.click();
  await expect(page.getByText("Overview")).toBeVisible();
  await expect(page.getByText("Media")).toBeVisible();
});
