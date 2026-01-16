import { test, expect } from "@playwright/test";

const HOST_EMAIL = process.env.E2E_HOST_EMAIL;
const HOST_PASSWORD = process.env.E2E_HOST_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const PROPERTY_ID = process.env.E2E_HOST_PROPERTY_ID;

test.describe("Host availability editor", () => {
  test.beforeEach(function () {
    if (!HOST_EMAIL || !HOST_PASSWORD || !PROPERTY_ID) {
      test.skip(true, "E2E host creds or property id not set");
    }
  });

  test("seed default and preview slots", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.getByLabel(/email/i).fill(HOST_EMAIL!);
    await page.getByLabel(/password/i).fill(HOST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto(`${BASE_URL}/host/properties/${PROPERTY_ID}/availability`);
    await expect(page.getByTestId("availability-page")).toBeVisible();

    await page.getByTestId("seed-default").click();

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.getByTestId("preview-date").fill(tomorrow);
    await page.getByRole("button", { name: /preview slots/i }).click();
    await expect(page.getByTestId("preview-slots")).toBeVisible();
  });
});
