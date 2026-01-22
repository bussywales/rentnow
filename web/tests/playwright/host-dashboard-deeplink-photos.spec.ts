import { test, expect } from "@playwright/test";

const PROPERTY_ID = process.env.E2E_DEEPLINK_PROPERTY_ID;

if (!PROPERTY_ID) {
  test.skip(true, "Deep link photos e2e disabled (set E2E_DEEPLINK_PROPERTY_ID)");
}

test.describe("Editor deep link to photos", () => {
  test("opens photos step when step=photos is present", async ({ page }) => {
    await page.goto(`/dashboard/properties/${PROPERTY_ID}?step=photos`);
    await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  });
});
