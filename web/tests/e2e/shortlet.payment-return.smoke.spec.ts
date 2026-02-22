import { test, expect } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";
import { mockSequentialJson } from "./utils/network";

test.describe("shortlet payment return smoke", () => {
  test("shows finalising first, then resolves to pending/confirmed", async ({ page }) => {
    const bookingId = "smoke-booking-1";

    await mockSequentialJson(page, /\/api\/shortlet\/payments\/status\?booking_id=/, [
      {
        ok: true,
        booking: {
          id: bookingId,
          status: "pending_payment",
          booking_mode: "request",
          total_amount_minor: 28000000,
          currency: "NGN",
          listing_title: "Smoke stay",
        },
        payment: {
          status: "succeeded",
          provider: "paystack",
        },
      },
      {
        ok: true,
        booking: {
          id: bookingId,
          status: "pending",
          booking_mode: "request",
          total_amount_minor: 28000000,
          currency: "NGN",
          listing_title: "Smoke stay",
        },
        payment: {
          status: "succeeded",
          provider: "paystack",
        },
      },
    ]);

    await page.goto(
      `/payments/shortlet/return?bookingId=${encodeURIComponent(
        bookingId
      )}&provider=paystack&reference=smoke-ref-1`
    );

    await expect(page.getByTestId(smokeSelectors.shortletReturnStatus)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletReturnFinalising)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletReturnPending)).toBeVisible({ timeout: 12_000 });
  });
});
