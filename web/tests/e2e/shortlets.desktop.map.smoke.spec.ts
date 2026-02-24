import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";
import { mockShortletsSearch } from "./utils/network";
import { waitForShortletsResultsSettled, waitForUrlParam } from "./utils/waits";

async function dragMap(page: Page, mapLocator: Locator) {
  const box = await mapLocator.boundingBox();
  if (!box) return;
  const startX = box.x + box.width * 0.65;
  const startY = box.y + box.height * 0.55;
  const endX = box.x + box.width * 0.25;
  const endY = box.y + box.height * 0.45;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

async function openFilters(page: Page) {
  await page.getByTestId(smokeSelectors.shortletsFiltersButton).click({ force: true });
  await expect(page.getByTestId(smokeSelectors.shortletsFiltersDrawer)).toBeVisible();
}

test.describe("shortlets desktop map behaviour", () => {
  test("mapAuto updates bbox automatically and manual mode requires Search this area", async ({ page }) => {
    await mockShortletsSearch(page);

    await page.goto("/shortlets", { waitUntil: "networkidle" });
    const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
    if (await dismissDisclaimer.isVisible().catch(() => false)) {
      await dismissDisclaimer.click();
    }
    await expect(page.getByTestId(smokeSelectors.shortletsMap)).toBeVisible();

    await openFilters(page);
    let autoToggle = page.getByTestId(smokeSelectors.shortletsMapMoveToggle);
    if (!(await autoToggle.isChecked())) {
      await autoToggle.check({ force: true });
    }
    await page
      .getByTestId(smokeSelectors.shortletsFiltersDrawer)
      .getByRole("button", { name: /^Apply$/i })
      .click({ force: true });

    const map = page.getByTestId(smokeSelectors.shortletsMap).locator(".leaflet-container");
    await dragMap(page, map);
    await waitForUrlParam(page, "bbox");
    await waitForShortletsResultsSettled(page);

    await openFilters(page);
    autoToggle = page.getByTestId(smokeSelectors.shortletsMapMoveToggle);
    if (await autoToggle.isChecked()) {
      await autoToggle.uncheck({ force: true });
    }
    await page
      .getByTestId(smokeSelectors.shortletsFiltersDrawer)
      .getByRole("button", { name: /^Apply$/i })
      .click({ force: true });

    const bboxInManualMode = new URL(page.url()).searchParams.get("bbox");
    await dragMap(page, map);
    expect(new URL(page.url()).searchParams.get("bbox")).toBe(bboxInManualMode);

    const searchArea = page.getByTestId(smokeSelectors.shortletsSearchThisArea).first();
    if (await searchArea.isVisible().catch(() => false)) {
      await searchArea.click();
      await waitForUrlParam(page, "bbox", { previousValue: bboxInManualMode });
      await waitForShortletsResultsSettled(page);
    }
  });
});
