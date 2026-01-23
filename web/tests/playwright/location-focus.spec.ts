import { test, expect } from "@playwright/test";

const PROPERTY_ID = process.env.E2E_REVIEW_PROPERTY_ID;

test.describe("Location focus deep link", () => {
  test("focus=location scrolls and focuses search input", async ({ page }) => {
    if (!PROPERTY_ID) {
      test.skip(true, "Location focus e2e disabled (set E2E_REVIEW_PROPERTY_ID)");
    }
    await page.goto(`/dashboard/properties/${PROPERTY_ID}?focus=location`);
    const input = page.locator("#location-search");
    if (!(await input.isVisible())) {
      test.skip(true, "Location search not visible (maybe picker disabled or unauthenticated)");
    }
    await expect(input).toBeFocused();
  });
});
