import { test, expect } from "@playwright/test";

const propertyId = process.env.E2E_CHECKIN_PROPERTY_ID;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!propertyId || !email || !password) {
  test.skip(true, "Check-in UI e2e disabled (set E2E_CHECKIN_PROPERTY_ID/E2E_EMAIL/E2E_PASSWORD)");
}

test.describe("Check-in UI", () => {
  test("host can see check-in button on edit page", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/dashboard/);

    await page.goto(`/dashboard/properties/${propertyId}`);
    await expect(page.getByText("Check in at this property")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in now" })).toBeVisible();
  });
});
