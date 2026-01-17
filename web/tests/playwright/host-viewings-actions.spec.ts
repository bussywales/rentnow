import { test, expect } from "@playwright/test";

const HOST_EMAIL = process.env.E2E_HOST_EMAIL;
const HOST_PASSWORD = process.env.E2E_HOST_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Host viewings actions", () => {
  test.beforeEach(() => {
    if (!HOST_EMAIL || !HOST_PASSWORD) {
      test.skip(true, "Host creds not set");
    }
  });

  test("host can confirm a viewing (mocked response)", async ({ page }) => {
    await page.route("**/api/viewings/respond", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.getByLabel(/email/i).fill(HOST_EMAIL!);
    await page.getByLabel(/password/i).fill(HOST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto(`${BASE_URL}/host/viewings`);
    const rows = page.getByTestId("host-viewing-row");
    const count = await rows.count();
    if (!count) {
      test.skip(true, "No viewings to act on");
    }

    const firstRow = rows.first();
    const confirmButton = firstRow.getByRole("button", { name: /Confirm this time/i });
    await confirmButton.click();
    await expect(firstRow).toContainText(/Viewing confirmed|Confirmed/i);
  });
});
