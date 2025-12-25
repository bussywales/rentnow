import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test.describe("Auth -> dashboard -> property detail", () => {
  test("login and reach dashboard and property detail", async ({ page }) => {
    test.skip(
      !HAS_CREDS,
      "Set PLAYWRIGHT_LANDLORD_EMAIL and PLAYWRIGHT_LANDLORD_PASSWORD to run this test."
    );

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page.getByText(/workspace/i)).toBeVisible();

    const firstCard = page.locator("a").filter({ hasText: /viewings|messages|new listing/i }).first();
    await expect(firstCard).toBeVisible();

    const propertyLink = page.locator("a").filter({ hasText: /ngn|usd|egp/i }).first();
    await propertyLink.click();

    await page.waitForURL("**/properties/**", { timeout: 10_000 });
    await expect(page.getByText(/Request a viewing/i)).toBeVisible();
    await expect(page.getByText(/Contact landlord|agent/i)).toBeVisible();
  });
});
