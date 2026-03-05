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

async function clickSearchThisArea(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForShortletsResultsSettled(page);
    const searchArea = page.getByTestId(smokeSelectors.shortletsSearchThisArea).first();
    if (!(await searchArea.isVisible().catch(() => false))) {
      return false;
    }

    try {
      await searchArea.click({ trial: true, timeout: 3_000 });
      await searchArea.click({ timeout: 5_000 });
      return true;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  return false;
}

function readBboxParam(page: Page) {
  return new URL(page.url()).searchParams.get("bbox");
}

function isValidBbox(value: string | null): value is string {
  if (!value) return false;
  const parts = value.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return false;
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  return minLng < maxLng && minLat < maxLat;
}

async function waitForBboxChange(page: Page, previousValue: string | null, timeout = 10_000) {
  await expect
    .poll(() => {
      const current = readBboxParam(page);
      return {
        changed: current !== null && current !== previousValue,
        current,
      };
    }, { timeout })
    .toEqual(
      expect.objectContaining({
        changed: true,
      })
    );
}

async function expectBboxUnchangedForDuration(
  page: Page,
  expectedValue: string | null,
  durationMs = 700
) {
  const start = Date.now();
  await expect
    .poll(() => {
      const current = readBboxParam(page);
      if (current !== expectedValue) {
        throw new Error(`bbox changed during manual mode window: expected=${expectedValue} current=${current}`);
      }
      return Date.now() - start;
    }, { timeout: durationMs + 600 })
    .toBeGreaterThanOrEqual(durationMs);
}

test.describe("shortlets desktop map behaviour", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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
    const autoBboxBeforeDrag = readBboxParam(page);
    await dragMap(page, map);
    await waitForBboxChange(page, autoBboxBeforeDrag);
    await waitForShortletsResultsSettled(page);
    const bboxInAutoMode = readBboxParam(page);
    expect(bboxInAutoMode).not.toBe(autoBboxBeforeDrag);
    expect(isValidBbox(bboxInAutoMode)).toBeTruthy();

    await openFilters(page);
    autoToggle = page.getByTestId(smokeSelectors.shortletsMapMoveToggle);
    if (await autoToggle.isChecked()) {
      await autoToggle.uncheck({ force: true });
    }
    await page
      .getByTestId(smokeSelectors.shortletsFiltersDrawer)
      .getByRole("button", { name: /^Apply$/i })
      .click({ force: true });
    await waitForShortletsResultsSettled(page);

    const bboxInManualMode = readBboxParam(page);
    expect(isValidBbox(bboxInManualMode)).toBeTruthy();
    await dragMap(page, map);
    await expectBboxUnchangedForDuration(page, bboxInManualMode);

    if (await clickSearchThisArea(page)) {
      await waitForBboxChange(page, bboxInManualMode);
      await waitForUrlParam(page, "bbox", { previousValue: bboxInManualMode });
      await waitForShortletsResultsSettled(page);
      const bboxAfterManualApply = readBboxParam(page);
      expect(bboxAfterManualApply).not.toBe(bboxInManualMode);
      expect(isValidBbox(bboxAfterManualApply)).toBeTruthy();
    }
  });
});
