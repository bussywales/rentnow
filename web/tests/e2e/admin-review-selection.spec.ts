import { test, expect } from "@playwright/test";

// Skip for now: requires seeded admin session and reviewable listings.
test.skip("admin review desk shows selected listing details", async ({ page }) => {
  await page.goto("/admin/review");
  await expect(page.getByText("Review Desk")).toBeVisible();
  await page.getByRole("button", { name: /Approve listing/i }).click();
});
