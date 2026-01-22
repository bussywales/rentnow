import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_PREPUBLISH_NUDGE === "true";

if (!SHOULD_RUN) {
  test.skip(true, "Pre-publish nudge e2e disabled (set E2E_ENABLE_PREPUBLISH_NUDGE=true to run)");
}

test.describe("Pre-publish nudge", () => {
  const fillBasics = async (page: import("@playwright/test").Page) => {
    await page.getByLabel("Listing title").fill("Test listing title");
    await page.getByLabel("City / Town").fill("Lagos");
    await page.getByLabel("Price").fill("1000");
    await page.getByLabel("Bedrooms").fill("2");
    await page.getByLabel("Bathrooms").fill("1");
  };

  const goToSubmit = async (page: import("@playwright/test").Page) => {
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Ready to submit?")).toBeVisible();
  };

  test("shows checklist and actions navigate to sections", async ({ page }) => {
    await page.goto("/dashboard/properties/new");
    await fillBasics(page);
    await goToSubmit(page);

    await expect(page.getByText("Before you publish")).toBeVisible();

    await page.getByRole("button", { name: "Improve location" }).click();
    await expect(page.getByText("Location")).toBeVisible();
    await page.waitForTimeout(200);
    await goToSubmit(page);

    await page.getByRole("button", { name: "Review photos" }).click();
    await expect(page.getByText("Photos (Supabase Storage)")).toBeVisible();
  });
});
