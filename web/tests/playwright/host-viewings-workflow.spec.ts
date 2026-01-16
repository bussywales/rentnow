import { test, expect } from "@playwright/test";

const HOST_EMAIL = process.env.E2E_HOST_EMAIL;
const HOST_PASSWORD = process.env.E2E_HOST_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Host viewings workflow", () => {
  test.beforeEach(() => {
    if (!HOST_EMAIL || !HOST_PASSWORD) {
      test.skip(true, "Host creds not set");
    }
  });

  test("host can open viewings inbox", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.getByLabel(/email/i).fill(HOST_EMAIL!);
    await page.getByLabel(/password/i).fill(HOST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto(`${BASE_URL}/host/viewings`);
    await expect(page.getByTestId("host-viewings-page")).toBeVisible();

    const rows = page.getByTestId("viewing-row");
    if (!(await rows.count())) {
      test.skip(true, "No viewings to act on");
    }
  });
});
