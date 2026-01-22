import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_HOST_DASHBOARD === "true";

if (!SHOULD_RUN) {
  test.skip(true, "Host dashboard saved views e2e disabled (set E2E_ENABLE_HOST_DASHBOARD=true to run)");
}

test.describe("Host dashboard saved views", () => {
  test("view selection updates URL, persists, and respects history", async ({ page }) => {
    await page.goto("/host");
    await expect(page.getByText("Saved views")).toBeVisible();

    await page.getByText("Needs attention").click();
    await expect(page).toHaveURL(/view=needs_attention/);

    await page.getByText("Drafts").click();
    await expect(page).toHaveURL(/view=drafts/);

    await page.goBack();
    await expect(page).toHaveURL(/view=needs_attention/);

    await page.goForward();
    await expect(page).toHaveURL(/view=drafts/);

    await page.goto("/host");
    await expect(page).toHaveURL(/view=drafts/);
  });
});
