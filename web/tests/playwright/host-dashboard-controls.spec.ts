import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_HOST_DASHBOARD === "true";

if (!SHOULD_RUN) {
  test.skip(true, "Host dashboard controls e2e disabled (set E2E_ENABLE_HOST_DASHBOARD=true to run)");
}

test.describe("Host dashboard controls", () => {
  test("renders search and chips", async ({ page }) => {
    await page.goto("/host");
    await expect(page.getByPlaceholder("Search by title or area")).toBeVisible();
    await expect(page.getByText("All")).toBeVisible();
    await expect(page.getByText("Needs attention")).toBeVisible();
    await expect(page.getByText("Ready to publish")).toBeVisible();
    await expect(page.getByText("Drafts")).toBeVisible();
  });
});
