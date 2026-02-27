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
  let react418Logged = false;

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
    if (!react418Logged && /Minified React error #418/i.test(error.message)) {
      react418Logged = true;
      const stackPreview = (error.stack ?? "")
        .split("\n")
        .slice(0, 15)
        .join(" | ");
      // Breadcrumb for intermittent hydration mismatches; log at most once per test run.
      console.error(
        `[golive][shortlets][react418] url=${page.url()} name=${error.name ?? "Error"} message=${error.message} stack=${stackPreview || "n/a"}`
      );
    }
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

    const visibleMap = page.locator(`[data-testid="${smokeSelectors.shortletsMap}"]:visible`).first();

    const openMobileMapSheet = async () => {
      const mapOpen = page.getByTestId(smokeSelectors.shortletsMapOpen);
      const mobileMapSheet = page.getByTestId(smokeSelectors.shortletsMobileMap);
      const mobileMapDialog = page.locator(`#${smokeSelectors.shortletsMobileMapDialog}`);

      await expect(mapOpen).toBeVisible();
      await mapOpen.click();

      await expect
        .poll(async () => {
          if (await mobileMapSheet.isVisible().catch(() => false)) return true;
          if (await mobileMapDialog.isVisible().catch(() => false)) return true;
          return false;
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
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedItem).first()).toBeVisible();

    const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
    if (await dismissDisclaimer.isVisible().catch(() => false)) {
      await dismissDisclaimer.click({ force: true });
    }

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: "auto" }));
    await expect
      .poll(
        async () => {
          const scrollY = await page.evaluate(() => Math.max(0, window.scrollY || 0));
          return scrollY >= 700;
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

    const mapOpen = page.getByTestId(smokeSelectors.shortletsMapOpen);
    const hasMapSheetToggle = await mapOpen.isVisible().catch(() => false);
    if (hasMapSheetToggle) {
      const supportButton = page.getByTestId(smokeSelectors.supportWidgetButton);
      const supportVisible = await supportButton.isVisible().catch(() => false);
      if (supportVisible) {
        const [mapBox, supportBox] = await Promise.all([mapOpen.boundingBox(), supportButton.boundingBox()]);
        if (mapBox && supportBox) {
          const overlapX =
            Math.min(mapBox.x + mapBox.width, supportBox.x + supportBox.width) -
            Math.max(mapBox.x, supportBox.x);
          const overlapY =
            Math.min(mapBox.y + mapBox.height, supportBox.y + supportBox.height) -
            Math.max(mapBox.y, supportBox.y);
          const hasOverlap = overlapX > 0 && overlapY > 0;
          expect(hasOverlap).toBeFalsy();
        }
      }

      const mobileMapSheet = await openMobileMapSheet();
      await expect(visibleMap).toBeVisible();
      const mapClose = page.getByTestId(smokeSelectors.shortletsMapClose);
      await mapClose.click({ force: true });
      await expect
        .poll(
          async () => {
            const isVisible = await mobileMapSheet.isVisible().catch(() => false);
            if (!isVisible) return true;
            await page.keyboard.press("Escape").catch(() => {});
            if (await mapClose.isVisible().catch(() => false)) {
              await mapClose.click({ force: true }).catch(() => {});
            }
            return !(await mobileMapSheet.isVisible().catch(() => false));
          },
          { timeout: 10_000 }
        )
        .toBeTruthy();
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

    const seededBrowseResponse = waitForShortletsSearchResponse(page, { required: false });
    await page.goto("/shortlets?where=Lekki&guests=2", { waitUntil: "domcontentloaded" });
    await seededBrowseResponse;
    await waitForShortletsResults(page);

    const baselineBrowseResponse = waitForShortletsSearchResponse(page, { required: false });
    await page.goto("/shortlets", { waitUntil: "domcontentloaded" });
    await baselineBrowseResponse;
    await waitForShortletsResults(page);
    await expect(page.getByTestId(smokeSelectors.shortletsContinueBrowsingChip)).toBeVisible();
    await page.getByTestId(`${smokeSelectors.shortletsContinueBrowsingChip}-link`).click({ force: true });
    await page.waitForURL(/\/shortlets\?.*where=Lekki/i, { timeout: 20_000 });

    expect(
      runtimeErrors,
      `shortlets mobile smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
