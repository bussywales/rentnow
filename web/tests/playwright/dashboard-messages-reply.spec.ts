import { test, expect } from "@playwright/test";

const HOST_EMAIL = process.env.E2E_HOST_EMAIL;
const HOST_PASSWORD = process.env.E2E_HOST_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Dashboard messages inbox", () => {
  test.beforeEach(() => {
    if (!HOST_EMAIL || !HOST_PASSWORD) {
      test.skip(true, "Host creds not set");
    }
  });

  test("host can open a thread and see composer (skip-safe)", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.getByLabel(/email/i).fill(HOST_EMAIL!);
    await page.getByLabel(/password/i).fill(HOST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto(`${BASE_URL}/dashboard/messages`);
    await expect(page.getByRole("heading", { name: /messages/i })).toBeVisible();

    const rows = page.getByTestId("message-thread-row");
    const count = await rows.count();
    if (!count) {
      test.skip(true, "No threads available");
    }
    await rows.first().click();
    await expect(page.getByRole("heading", { name: /conversation/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send message/i })).toBeVisible();

    const unreadBadges = page.getByTestId("message-thread-unread");
    if (await unreadBadges.count()) {
      await unreadBadges.first().locator("xpath=ancestor::button[1]").click();
      await expect(page.getByTestId("message-new-divider")).toBeVisible();
    }
  });
});
