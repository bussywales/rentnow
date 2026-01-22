import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_PROPERTY_STEPPER_SAVE === "true";

if (!SHOULD_RUN) {
  test.skip(true, "Save status e2e disabled (set E2E_ENABLE_PROPERTY_STEPPER_SAVE=true to run)");
}

test.describe("Listing wizard save status", () => {
  test("shows saving then saved during draft save", async ({ page }) => {
    await page.goto("/dashboard/properties/new");
    await page.getByLabel("Title").fill("Test listing");
    await page.getByLabel("City").fill("Test City");
    await page.getByLabel("Price").fill("1000");
    await page.getByLabel("Bedrooms").fill("1");
    await page.getByLabel("Bathrooms").fill("1");
    await page.getByLabel("Currency").fill("USD");

    await expect(page.getByText("Saving…")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 8000 });
  });
});
