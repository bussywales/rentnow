import { test, expect, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const HOST_EMAIL = process.env.PLAYWRIGHT_HOST_EMAIL || process.env.E2E_HOST_EMAIL || "";
const HOST_PASSWORD = process.env.PLAYWRIGHT_HOST_PASSWORD || process.env.E2E_HOST_PASSWORD || "";

type CreatedBlock = {
  id: string;
  property_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
};

async function loginAsHost(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(HOST_EMAIL);
  await page.getByLabel(/password/i).first().fill(HOST_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 20_000 });
}

test.describe("host calendar smoke", () => {
  test("host can block and unblock dates", async ({ page }) => {
    test.skip(!HOST_EMAIL || !HOST_PASSWORD, "Host credentials not configured for smoke run.");

    let createdBlock: CreatedBlock | null = null;

    await page.route("**/api/shortlet/blocks", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const payload = (route.request().postDataJSON() || {}) as {
        property_id?: string;
        date_from?: string;
        date_to?: string;
      };

      createdBlock = {
        id: `smoke-block-${Date.now()}`,
        property_id: String(payload.property_id || ""),
        date_from: String(payload.date_from || ""),
        date_to: String(payload.date_to || ""),
        reason: null,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ block: createdBlock }),
      });
    });

    await page.route("**/api/shortlet/blocks/*", async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await loginAsHost(page);
    await page.goto("/host/calendar", { waitUntil: "networkidle" });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Host session could not be established.");
    }

    await expect(page.getByTestId(smokeSelectors.hostCalendarPage)).toBeVisible();
    const calendar = page.getByTestId(smokeSelectors.hostCalendar);
    await expect(calendar).toBeVisible();

    const emptyCalendar = page.getByText(/No shortlet listings available for calendar management yet\./i);
    if (await emptyCalendar.isVisible().catch(() => false)) {
      test.skip(true, "No host shortlet listings available for calendar smoke assertions.");
    }

    const enabledDays = calendar.locator("button.rdp-day_button:not([disabled])");
    const enabledCount = await enabledDays.count();
    test.skip(enabledCount < 8, "Not enough selectable calendar dates for block smoke flow.");

    await enabledDays.nth(2).click();
    await enabledDays.nth(5).click();

    await calendar.getByRole("button", { name: /^Block dates$/i }).click();
    await expect(calendar.getByText(/Dates blocked\./i)).toBeVisible();

    test.skip(!createdBlock, "Block API interception did not capture a created range.");

    const createdRangeLabel = `${createdBlock!.date_from} to ${createdBlock!.date_to}`;
    const blocksPanel = calendar.locator("aside").filter({ hasText: /Existing blocks/i }).first();
    await expect(blocksPanel.getByText(createdRangeLabel)).toBeVisible();

    const createdRow = blocksPanel.locator("div").filter({ hasText: createdRangeLabel }).first();
    await createdRow.getByRole("button", { name: /Unblock/i }).click();

    await expect(calendar.getByText(/Block removed\./i)).toBeVisible();
  });
});
