import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_LOCATION_PICKER === "true";

// Skip-safe: only runs when explicit flag is set
if (!SHOULD_RUN) {
  test.skip(true, "Location picker e2e disabled (set E2E_ENABLE_LOCATION_PICKER=true to run)");
}

test.describe("Location picker", () => {
  test("new listing page renders location search", async ({ page }) => {
    await page.goto("/dashboard/properties/new");
    await expect(page.locator("h1", { hasText: "Create listing" })).toBeVisible();
    await expect(page.getByLabel("Search location")).toBeVisible();
  });
});
