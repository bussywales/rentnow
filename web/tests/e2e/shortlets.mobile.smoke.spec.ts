import { test, expect } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";
import { mockShortletsSearch } from "./utils/network";
import { waitForShortletsResultsSettled } from "./utils/waits";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("shortlets mobile smoke", () => {
  test("mobile discovery supports filters and map overlay", async ({ page }) => {
    await mockShortletsSearch(page);

    await page.goto("/shortlets", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: /find shortlets/i })).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsShell)).toBeVisible();
    const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
    if (await dismissDisclaimer.isVisible().catch(() => false)) {
      await dismissDisclaimer.click({ force: true });
    }

    await page.evaluate(() => window.scrollTo({ top: 720, behavior: "auto" }));
    await expect(page.getByTestId(smokeSelectors.shortletsStickyPill)).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));

    await page.getByTestId(smokeSelectors.shortletsFiltersButton).click();
    await expect(page.getByTestId(smokeSelectors.shortletsFiltersDrawer)).toBeVisible();

    await page.getByTestId(smokeSelectors.shortletsFiltersDrawer).getByLabel("Power backup").check();
    await page.getByRole("button", { name: /^Apply$/i }).click();

    await expect(page.getByTestId(smokeSelectors.shortletsFiltersDrawer)).toBeHidden();
    await expect(page.getByTestId(smokeSelectors.shortletsFiltersButton)).toContainText(
      /Filters \(1\)/i
    );
    await waitForShortletsResultsSettled(page);

    await page.getByTestId(smokeSelectors.shortletsMapOpen).click({ force: true });
    await expect(page.getByTestId(smokeSelectors.shortletsMobileMap)).toBeVisible();
    await expect(
      page.getByTestId(smokeSelectors.shortletsMobileMap).getByTestId(smokeSelectors.shortletsMap)
    ).toBeVisible();

    await page.getByTestId(smokeSelectors.shortletsMapClose).click();
    await expect(page.getByTestId(smokeSelectors.shortletsMobileMap)).toBeHidden();
    await expect(page.getByTestId(smokeSelectors.shortletsShell)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsMapOpen)).toBeVisible();
    const isScrollable = await page.evaluate(() => {
      const scroller = document.scrollingElement;
      if (!scroller) return false;
      return scroller.scrollHeight > window.innerHeight;
    });
    expect(isScrollable).toBeTruthy();
  });
});
