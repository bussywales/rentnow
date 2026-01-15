import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL || "";
const PASSWORD = process.env.E2E_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test("viewing request handlers set marker headers", async ({ page }) => {
  test.skip(!HAS_CREDS, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto("/properties");
  const empty = page.getByTestId("properties-empty-state");
  if (await empty.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(empty).toBeVisible();
    test.skip(true, "No properties available to request viewings against.");
  }

  const firstCardLink = page.locator('[data-testid="property-card"] a').first();
  await expect(firstCardLink).toBeVisible({ timeout: 10_000 });
  const href = await firstCardLink.getAttribute("href");
  expect(href).toBeTruthy();
  const propertyId = href?.split("/").pop();
  expect(propertyId).toBeTruthy();

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const isoLocal = `${dateStr}T10:00`;

  const legacyPayload = {
    property_id: propertyId,
    preferred_date: dateStr,
    preferred_time_window: "2-4pm",
    note: "",
  };
  const legacyRes = await page.request.post("/api/viewings", { data: legacyPayload });
  expect(await legacyRes.headerValue("x-viewings-handler")).toBe("legacy-alias");
  expect(legacyRes.status()).toBeLessThan(500);

  const modernPayload = {
    propertyId,
    preferredTimes: [isoLocal],
    message: "playwright check",
  };
  const modernRes = await page.request.post("/api/viewings/request", { data: modernPayload });
  expect(await modernRes.headerValue("x-viewings-handler")).toBe("request");
  expect(modernRes.status()).toBeLessThan(500);
});
