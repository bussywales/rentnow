import { expect, test } from "@playwright/test";

test.describe("Properties intent URL behavior", () => {
  test("adds intent=rent when URL omits intent", async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("ph_intent");
      } catch {
        // ignore storage access issues
      }
    });

    await page.goto("/properties?city=Lagos&bedrooms=4");
    await expect(page).toHaveURL(/\/properties\?.*intent=rent/);
  });

  test("toggle updates URL from rent to buy", async ({ page }) => {
    await page.goto("/properties?city=Lagos&bedrooms=4&intent=rent");
    await page.getByRole("tab", { name: "For sale" }).click();
    await expect(page).toHaveURL(/\/properties\?.*intent=buy/);
    await expect(page).not.toHaveURL(/intent=rent/);
  });

  test("success param shows toast and is stripped from URL", async ({ page }) => {
    await page.goto(
      "/properties?source=saved-search&intent=all&success=Found%203%20matches%20for%20Lagos"
    );

    await expect(page.getByText("Found 3 matches for Lagos")).toBeVisible();
    await expect(page).not.toHaveURL(/success=/);
    await expect(page).toHaveURL(/source=saved-search/);
    await expect(page).toHaveURL(/intent=all/);
  });
});
