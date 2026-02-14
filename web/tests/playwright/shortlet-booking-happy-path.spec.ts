import { expect, test } from "@playwright/test";

const shortletPropertyId = process.env.PLAYWRIGHT_SHORTLET_PROPERTY_ID;

test.describe("Shortlet booking happy path", () => {
  test("tenant can open booking widget and submit request/booking", async ({ page }) => {
    test.skip(!shortletPropertyId, "PLAYWRIGHT_SHORTLET_PROPERTY_ID is required for shortlet booking smoke test");

    await page.goto(`/properties/${shortletPropertyId}`);
    await expect(page.getByRole("heading", { name: /book this shortlet/i })).toBeVisible();
    await page.getByRole("button", { name: /book now|request to book/i }).click();
    await expect(page.getByText(/booking request sent|booking confirmed/i)).toBeVisible();
  });
});

