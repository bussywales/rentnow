import { expect, type Page } from "@playwright/test";

type WaitForUrlParamOptions = {
  timeout?: number;
  previousValue?: string | null;
};

export async function waitForUrlParam(
  page: Page,
  key: string,
  { timeout = 10_000, previousValue }: WaitForUrlParamOptions = {}
) {
  await expect
    .poll(() => {
      const value = new URL(page.url()).searchParams.get(key);
      if (value === null || value.length === 0) {
        return false;
      }
      if (previousValue === undefined) {
        return true;
      }
      return value !== previousValue;
    }, { timeout })
    .toBeTruthy();
}

export async function waitForShortletsResultsSettled(page: Page, timeout = 10_000) {
  const label = page.locator('[data-testid="shortlets-results-label"]:visible').first();
  await expect(label).toBeVisible({ timeout });
  await expect(label).not.toContainText(/Loading stays/i, { timeout });
  await expect(label).not.toContainText(/Refreshing map results/i, { timeout });
}
