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
    await expect(page.getByLabel("Search for an area")).toBeVisible();
    await expect(page.getByText("Searching")).toBeVisible();
  });

  test("shows not configured message when mapbox missing", async ({ page }) => {
    if (process.env.E2E_EXPECT_MAPBOX_MISSING !== "true") {
      test.skip(true, "MAPBOX missing check disabled");
    }
    await page.goto("/dashboard/properties/new");
    await page.getByLabel("Search for an area").fill("Lagos");
    await expect(
      page.getByText(
        "Location search isn't configured yet (MAPBOX_TOKEN missing). You can still enter location fields manually below."
      )
    ).toBeVisible();
  });

  test("shows postcode hint when country not selected", async ({ page }) => {
    await page.goto("/dashboard/properties/new");
    await page.getByLabel("Search for an area").fill("ST6 3EG");
    await expect(
      page.getByText("Looks like a postcode — choose a country to improve results.")
    ).toBeVisible();
  });
});
