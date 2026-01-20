import { test, expect } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_REQUIRE_LOCATION_PIN === "true";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!SHOULD_RUN || !email || !password) {
  test.skip(true, "Location publish flag e2e disabled (set E2E_REQUIRE_LOCATION_PIN=true and creds)");
}

test.describe("Location publish flag", () => {
  test("shows location required banner when publishing without pin", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/dashboard/);

    await page.goto("/dashboard/properties/new");
    await expect(page.getByRole("heading", { name: "Create listing" })).toBeVisible();
    // Minimal required fields
    await page.getByLabel("Listing title").fill("Test listing");
    await page.getByLabel("City").fill("Test City");
    await page.getByLabel("Price").fill("1000");
    await page.getByLabel("Bedrooms").fill("1");
    await page.getByLabel("Bathrooms").fill("1");

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Pin your listing location to publish")).toBeVisible();
  });
});
