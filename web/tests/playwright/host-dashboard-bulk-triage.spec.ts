import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_HOST_DASHBOARD === "true";

if (!SHOULD_RUN) {
  test.skip(true, "Host dashboard bulk triage e2e disabled (set E2E_ENABLE_HOST_DASHBOARD=true to run)");
}

test.describe("Host dashboard bulk triage", () => {
  test("selection shows bulk bar and clear hides it", async ({ page }) => {
    await page.goto("/host");
    await expect(page.getByText("Saved views")).toBeVisible();
    const firstSelect = page.getByLabel("Select").first();
    await firstSelect.check();
    await expect(page.getByText("selected", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("selected", { exact: false })).not.toBeVisible();
  });
});
