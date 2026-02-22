import { test, expect, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const HOST_EMAIL = process.env.PLAYWRIGHT_HOST_EMAIL || process.env.E2E_HOST_EMAIL || "";
const HOST_PASSWORD = process.env.PLAYWRIGHT_HOST_PASSWORD || process.env.E2E_HOST_PASSWORD || "";

async function loginAsHost(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(HOST_EMAIL);
  await page.getByLabel(/password/i).first().fill(HOST_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 20_000 });
}

test.describe("host bookings smoke", () => {
  test("awaiting approval inbox keeps urgency order and shows drawer actions", async ({ page }) => {
    test.skip(!HOST_EMAIL || !HOST_PASSWORD, "Host credentials not configured for smoke run.");

    await loginAsHost(page);
    await page.goto("/host/bookings?view=awaiting_approval", { waitUntil: "networkidle" });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Host session could not be established.");
    }

    await expect(page.getByTestId(smokeSelectors.hostBookingsInbox)).toBeVisible();

    const rows = page.getByTestId(smokeSelectors.hostBookingRow);
    const rowCount = await rows.count();
    test.skip(rowCount < 1, "No host bookings available for smoke assertions.");

    const respondByValues = await rows.evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("data-respond-by") || "")
        .filter((value) => /^\d{4}-\d{2}-\d{2}T/.test(value))
    );

    if (respondByValues.length >= 2) {
      const timestamps = respondByValues.map((value) => Date.parse(value));
      const isAscending = timestamps.every((value, index) => index === 0 || timestamps[index - 1] <= value);
      expect(isAscending).toBeTruthy();
    }

    await page.getByTestId(smokeSelectors.hostBookingView).first().click();
    await expect(page.getByTestId(smokeSelectors.hostBookingDrawer)).toBeVisible();

    const approve = page.getByTestId(smokeSelectors.hostBookingApprove);
    const decline = page.getByTestId(smokeSelectors.hostBookingDecline);

    if ((await approve.count()) === 0 || (await decline.count()) === 0) {
      test.skip(true, "Selected booking is not actionable in this environment.");
    }

    await expect(approve.first()).toBeVisible();
    await expect(decline.first()).toBeVisible();
  });
});
