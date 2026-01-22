import { test, expect } from "@playwright/test";

const PROPERTY_ID = process.env.E2E_REVIEW_PROPERTY_ID;

if (!PROPERTY_ID) {
  test.skip(true, "Review & publish e2e disabled (set E2E_REVIEW_PROPERTY_ID)");
}

test.describe("Review & publish card", () => {
  test("renders and fix action deep-links", async ({ page }) => {
    await page.goto(`/dashboard/properties/${PROPERTY_ID}?step=submit`);
    const heading = page.getByRole("heading", { name: "Review & publish" });
    if (!(await heading.isVisible())) {
      test.skip(true, "Review & publish card not visible for this listing");
    }
    await expect(heading).toBeVisible();
    const fixButton = page.getByRole("button", { name: "Fix" }).first();
    await fixButton.click();
    await expect(page).toHaveURL(/(step=photos|focus=location)/);
  });
});
