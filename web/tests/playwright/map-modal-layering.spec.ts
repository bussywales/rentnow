import { expect, test } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test("request viewing modal stays interactive over open map", async ({ page }) => {
  test.skip(!HAS_CREDS, "Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|tenant|host/, { timeout: 20_000 });

  await page.goto("/properties");
  const firstCardLink = page.locator('[data-testid="property-card"] a').first();
  if (!(await firstCardLink.isVisible().catch(() => false))) {
    test.skip(true, "No property cards available.");
  }

  const href = await firstCardLink.getAttribute("href");
  if (!href) {
    test.skip(true, "No property link available.");
  }

  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/properties/**", { timeout: 20_000 });

  const showMapButton = page.getByRole("button", { name: /show map/i }).first();
  if (await showMapButton.isVisible().catch(() => false)) {
    await showMapButton.click();
    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 10_000 });
  }

  const requestButton = page.getByTestId("request-viewing-button").first();
  if (!(await requestButton.isVisible().catch(() => false))) {
    test.skip(true, "Viewing CTA unavailable for this listing/user.");
  }
  if (await requestButton.isDisabled()) {
    test.skip(true, "Viewing CTA disabled for this listing/user.");
  }

  await requestButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  await dialog.getByRole("button", { name: /cancel/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
});
