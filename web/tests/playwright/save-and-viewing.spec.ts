import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;
const ALLOW_WRITE = (process.env.PLAYWRIGHT_ALLOW_WRITE || "false").toLowerCase() === "true";

test.describe("Save property and viewing request", () => {
  test("save toggle and optional viewing request", async ({ page }) => {
    test.skip(!HAS_CREDS, "Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD to run this test.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page.getByText(/workspace/i)).toBeVisible();

    const propertyLink = page.locator("a").filter({ hasText: /ngn|usd|egp|zar|kes/i }).first();
    await propertyLink.click();
    await page.waitForURL("**/properties/**", { timeout: 10_000 });

    const saveButton = page.getByRole("button", { name: /save property|saved/i }).first();
    await saveButton.click();
    await expect(saveButton).toHaveText(/saved/i, { timeout: 10_000 });

    if (!ALLOW_WRITE) {
      test.skip(true, "PLAYWRIGHT_ALLOW_WRITE not enabled; skipping viewing request");
    }

    const dateInput = page.locator('input[type="date"]').first();
    const today = new Date();
    today.setDate(today.getDate() + 2);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    await dateInput.fill(`${yyyy}-${mm}-${dd}`);

    await page.getByPlaceholder(/Preferred time window/i).fill("Afternoon");
    await page.getByPlaceholder(/Anything the host should know/i).fill("Playwright e2e test request");
    await page.getByRole("button", { name: /request viewing/i }).click();
    await expect(page.getByText(/Request sent/i)).toBeVisible({ timeout: 10_000 });
  });
});
