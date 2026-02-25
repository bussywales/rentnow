import { test, expect } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";
import { mockShortletsSearch } from "./utils/network";
import { waitForShortletsResults, waitForShortletsSearchResponse } from "./utils/waits";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];

function attachRuntimeErrorGuards(page: import("@playwright/test").Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
      return;
    }
    if (message.type() === "error" || /Unhandled|TypeError|ReferenceError/i.test(text)) {
      runtimeErrors.push(`[console:${message.type()}] ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    runtimeErrors.push(`[pageerror] ${error.message}`);
  });

  return runtimeErrors;
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("shortlets mobile smoke", () => {
  test("mobile discovery supports filters and map overlay", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);

    const closeSupportPanelIfOpen = async () => {
      const supportPanel = page.getByTestId(smokeSelectors.supportWidgetPanel);
      if (!(await supportPanel.isVisible().catch(() => false))) return;
      const closeButton = supportPanel.getByRole("button", { name: /close/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true });
      }
      await expect(supportPanel).toBeHidden();
    };

    const visibleMap = page.locator(`[data-testid="${smokeSelectors.shortletsMap}"]:visible`).first();

    const openMobileMapSheet = async () => {
      const mapOpen = page.getByTestId(smokeSelectors.shortletsMapOpen);
      const mobileMapSheet = page.getByTestId(smokeSelectors.shortletsMobileMap);
      const mobileMapDialog = page.locator(`#${smokeSelectors.shortletsMobileMapDialog}`);

      await expect(mapOpen).toBeVisible();
      await closeSupportPanelIfOpen();

      await mapOpen.evaluate((element) => {
        element.click();
      });

      await expect
        .poll(async () => {
          if (await mobileMapSheet.isVisible().catch(() => false)) return true;
          if (await mobileMapDialog.isVisible().catch(() => false)) return true;
          const supportPanel = page.getByTestId(smokeSelectors.supportWidgetPanel);
          if (await supportPanel.isVisible().catch(() => false)) {
            const closeButton = supportPanel.getByRole("button", { name: /close/i }).first();
            if (await closeButton.isVisible().catch(() => false)) {
              await closeButton.click({ force: true });
            }
          }
          await mapOpen.evaluate((element) => {
            element.click();
          });
          const sheetVisible = await mobileMapSheet.isVisible().catch(() => false);
          if (sheetVisible) return true;
          return mobileMapDialog.isVisible().catch(() => false);
        }, { timeout: 10_000 })
        .toBeTruthy();

      return mobileMapSheet;
    };

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
      const mobileMapSheet = await openMobileMapSheet();
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
    expect(
      runtimeErrors,
      `shortlets mobile smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
