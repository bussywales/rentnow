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

  test("host can open inbox and mark no-show (skip-safe)", async ({ page, context }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.getByLabel(/email/i).fill(HOST_EMAIL!);
    await page.getByLabel(/password/i).fill(HOST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto(`${BASE_URL}/host/viewings`);
    await expect(page.getByTestId("host-viewings-page")).toBeVisible();

    const rows = page.getByTestId("host-viewing-row");
    const count = await rows.count();
    if (!count) {
      test.skip(true, "No viewings to act on");
    }

    const firstRow = rows.first();
    const title = await firstRow.getByTestId("host-viewing-title").innerText();
    const markButton = firstRow.getByTestId("mark-no-show");

    if (await markButton.isDisabled()) {
      test.skip(true, "No-show already recorded");
    }

    await markButton.click();
    await expect(markButton).toHaveText(/No-show recorded/i);

    const tenantEmail = process.env.E2E_EMAIL;
    const tenantPassword = process.env.E2E_PASSWORD;
    if (!tenantEmail || !tenantPassword) {
      test.skip(true, "Tenant creds not set");
    }

    const tenantPage = await context.newPage();
    await tenantPage.goto(`${BASE_URL}/auth/login`);
    await tenantPage.getByLabel(/email/i).fill(tenantEmail!);
    await tenantPage.getByLabel(/password/i).fill(tenantPassword!);
    await tenantPage.getByRole("button", { name: /log in/i }).click();

    await tenantPage.goto(`${BASE_URL}/tenant/viewings`);
    const tenantRows = tenantPage.getByTestId("viewing-row");
    const tenantCount = await tenantRows.count();
    if (!tenantCount) {
      test.skip(true, "Tenant has no viewings");
    }

    const matchingRow = tenantRows.filter({ hasText: title });
    if ((await matchingRow.count()) === 0) {
      test.skip(true, "No matching viewing for tenant to confirm no-show");
    }

    await expect(matchingRow.first().getByText(/Marked as no-show by host/i)).toBeVisible();
  });
});
