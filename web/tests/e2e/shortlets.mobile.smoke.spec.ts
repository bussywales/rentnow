import { test, expect } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";
import { mockShortletsSearch } from "./utils/network";
import { waitForShortletsResults, waitForShortletsSearchResponse } from "./utils/waits";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("shortlets mobile smoke", () => {
  test("mobile discovery supports filters and map overlay", async ({ page }) => {
    const closeSupportPanelIfOpen = async () => {
      const supportPanel = page.getByTestId(smokeSelectors.supportWidgetPanel);
      if (!(await supportPanel.isVisible().catch(() => false))) return;
      const closeButton = supportPanel.getByRole("button", { name: /close/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true });
      }
      await expect(supportPanel).toBeHidden();
    };

    const visibleMap = page.locator('[data-testid="shortlets-map"]:visible').first();

    await mockShortletsSearch(page);
    const initialResultsResponse = waitForShortletsSearchResponse(page);

    await page.goto("/shortlets", { waitUntil: "domcontentloaded" });
    await initialResultsResponse;

    await expect(page.getByRole("heading", { name: /find shortlets/i })).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsShell)).toBeVisible();
    await waitForShortletsResults(page);
    await closeSupportPanelIfOpen();

    const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
    if (await dismissDisclaimer.isVisible().catch(() => false)) {
      await dismissDisclaimer.click({ force: true });
    }

    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.scrollTo({ top: 900, behavior: "auto" }));
          return page.getByTestId(smokeSelectors.shortletsStickyPill).isVisible().catch(() => false);
        },
        { timeout: 10_000 }
      )
      .toBeTruthy();

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));

    await page.getByTestId(smokeSelectors.shortletsFiltersButton).click();
    await expect(page.getByTestId(smokeSelectors.shortletsFiltersDrawer)).toBeVisible();

    const filtersDrawer = page.getByTestId(smokeSelectors.shortletsFiltersDrawer);
    const powerBackupToggle = filtersDrawer.getByLabel("Power backup");
    const wasPowerBackupChecked = await powerBackupToggle.isChecked();
    if (wasPowerBackupChecked) {
      await powerBackupToggle.uncheck();
    } else {
      await powerBackupToggle.check();
    }
    const filteredResultsResponse = waitForShortletsSearchResponse(page, { required: false });
    await filtersDrawer.getByRole("button", { name: /^Apply$/i }).click({ force: true });
    await filteredResultsResponse;
    if (await filtersDrawer.isVisible().catch(() => false)) {
      await filtersDrawer.getByRole("button", { name: /close filters/i }).click({ force: true });
    }
    await expect(filtersDrawer).toBeHidden();
    await waitForShortletsResults(page);
    await closeSupportPanelIfOpen();

    const mapOpen = page.getByTestId(smokeSelectors.shortletsMapOpen);
    const hasMapSheetToggle = await mapOpen.isVisible().catch(() => false);
    if (hasMapSheetToggle) {
      await mapOpen.click({ force: true });
      const mobileMapSheet = page.getByTestId(smokeSelectors.shortletsMobileMap);
      await expect(mobileMapSheet).toBeVisible();
      await expect(visibleMap).toBeVisible();
      await page.getByTestId(smokeSelectors.shortletsMapClose).click();
      await expect(mobileMapSheet).toBeHidden();
    } else {
      await expect(visibleMap).toBeVisible();
    }
    await expect(page.getByTestId(smokeSelectors.shortletsShell)).toBeVisible();
    if (hasMapSheetToggle) {
      await expect(mapOpen).toBeVisible();
    } else {
      await expect(visibleMap).toBeVisible();
    }
    const isScrollable = await page.evaluate(() => {
      const scroller = document.scrollingElement;
      if (!scroller) return false;
      return scroller.scrollHeight > window.innerHeight;
    });
    expect(isScrollable).toBeTruthy();
  });
});
