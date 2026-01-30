import { test, expect } from "@playwright/test";

test("public listing cards show identity trust pill (skip-safe)", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByTestId("properties-grid")).toBeVisible();

  const cards = page.getByTestId("property-card");
  const count = await cards.count();
  test.skip(count === 0, "No property cards available to assert trust pill.");

  const pill = page.getByTestId("trust-identity-pill").first();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveText(/Identity verified|Identity pending/);

  await expect(page.getByText(/Email not verified/i)).toHaveCount(0);
  await expect(page.getByText(/Phone not verified/i)).toHaveCount(0);
  await expect(page.getByText(/Bank not verified/i)).toHaveCount(0);
});
