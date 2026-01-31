import { test, expect, type Page } from "@playwright/test";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|tenant|host|properties)/, { timeout: 15_000 });
}

test.describe("Buy enquiry flow (skip-safe)", () => {
  test("tenant can submit buy enquiry and reach messages", async ({ page }) => {
    test.skip(!HAS_TENANT, "Tenant creds not set");
    await login(page, TENANT_EMAIL, TENANT_PASSWORD);

    await page.goto(`${BASE_URL}/properties`);
    const forSale = page.getByText("FOR SALE");
    const count = await forSale.count();
    if (!count) {
      test.skip(true, "No BUY listings available");
    }

    await forSale.first().locator("xpath=ancestor::a[1]").click();
    await expect(page.getByRole("button", { name: /enquire to buy/i })).toBeVisible();
    await page.getByRole("button", { name: /enquire to buy/i }).click();

    await page.getByLabel(/message/i).fill("I am interested in buying this home.");
    await page.getByLabel(/keep communication in-app/i).check();
    await page.getByRole("button", { name: /send enquiry/i }).click();

    await page.waitForURL(/\/dashboard\/messages\?thread=/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /conversation/i })).toBeVisible();
  });
});
