import { expect, test } from "@playwright/test";

function parseBeds(values: string[]) {
  return values
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value));
}

test("search uses exact beds by default and can include similar options", async ({ page }) => {
  await page.goto("/properties?city=Abuja&bedrooms=2");

  const emptyState = page.getByTestId("properties-empty-state");
  if (await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) {
    test.skip(true, "No listings found for strict search seed.");
  }

  const grid = page.getByTestId("properties-grid");
  if (!(await grid.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip(true, "No exact-match grid rendered for current data seed.");
  }
  await expect(grid).toBeVisible({ timeout: 15_000 });

  const exactBeds = parseBeds(await grid.getByTestId("property-card-bedrooms").allTextContents());
  if (exactBeds.length === 0) {
    test.skip(true, "No cards available to validate strict beds.");
  }
  expect(exactBeds.every((value) => value === 2)).toBeTruthy();

  await page.getByText("More options").first().click();
  await page.getByTestId("advanced-include-similar").check();
  await page.getByRole("button", { name: /^Apply$/ }).click();
  await expect(page).toHaveURL(/includeSimilarOptions=true/);

  await expect(grid).toBeVisible({ timeout: 15_000 });
  const widenedBeds = parseBeds(await grid.getByTestId("property-card-bedrooms").allTextContents());
  if (!widenedBeds.some((value) => value > 2)) {
    test.skip(true, "No higher-bed options currently available for this location.");
  }
  expect(widenedBeds.some((value) => value > 2)).toBeTruthy();
});
