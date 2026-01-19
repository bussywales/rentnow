import { test, expect } from "@playwright/test";

test.skip(process.env.E2E_EMAIL === undefined || process.env.E2E_PASSWORD === undefined, "E2E creds missing");

test("property detail renders without exposing GPS data", async ({ page }) => {
  const targetUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  await page.goto(`${targetUrl}/properties`);
  await page.waitForTimeout(1000);
  const firstCard = page.locator("[data-testid=\"property-card\"]").first();
  await firstCard.click();
  await page.waitForTimeout(1000);
  await expect(page.locator("body")).not.toContainText(/verified/i);
});
