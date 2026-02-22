import { test, expect } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

test.describe("property detail booking calendar smoke", () => {
  test("calendar blocks disabled days and applies a valid range", async ({ page }) => {
    const response = await page.request.get("/api/shortlets/search?page=1&pageSize=20");
    test.skip(!response.ok(), "Shortlets search API unavailable for smoke.");

    const payload = (await response.json()) as {
      items?: Array<{ id?: string; nightlyPriceMinor?: number | null; pricingMode?: string }>;
    };

    const bookable = (payload.items ?? []).find(
      (item) =>
        typeof item.id === "string" &&
        item.id.length > 0 &&
        Number(item.nightlyPriceMinor ?? 0) > 0 &&
        (item.pricingMode ?? "nightly") !== "price_on_request"
    );

    test.skip(!bookable?.id, "No bookable shortlet found for calendar smoke.");

    await page.goto(`/properties/${bookable!.id}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId(smokeSelectors.shortletBookingWidget)).toBeVisible();

    await page.getByTestId(smokeSelectors.shortletCheckInTrigger).click();

    const calendar = page.locator(
      `[data-testid="${smokeSelectors.shortletCalendarPopover}"], [data-testid="${smokeSelectors.shortletCalendarSheet}"]`
    );
    await expect(calendar).toBeVisible();

    const disabledDay = calendar.locator("button.rdp-day_button[disabled]").first();
    if ((await disabledDay.count()) > 0) {
      await expect(disabledDay).toBeDisabled();
      const checkInBefore = (await page.getByTestId(smokeSelectors.shortletCheckInTrigger).textContent()) ?? "";
      await disabledDay.dispatchEvent("click");
      await expect(page.getByTestId(smokeSelectors.shortletCheckInTrigger)).toContainText(
        checkInBefore.trim() || "Select date"
      );
    }

    const enabledDays = calendar.locator("button.rdp-day_button:not([disabled])");
    const enabledCount = await enabledDays.count();
    test.skip(enabledCount < 10, "Not enough selectable dates available for range selection smoke.");

    await enabledDays.nth(2).click();
    await enabledDays.nth(8).click();
    await page.getByRole("button", { name: /Apply dates/i }).click();

    await expect(page.getByTestId(smokeSelectors.shortletCheckInTrigger)).not.toContainText(/Select date/i);

    const cta = page.getByTestId(smokeSelectors.shortletCtaPrimary);
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });
});
