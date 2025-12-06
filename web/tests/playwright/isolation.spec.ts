import { test, expect } from "@playwright/test";

const TENANT_EMAIL = process.env.PLAYWRIGHT_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_TENANT_PASSWORD || "";

test.describe("Role isolation (tenant)", () => {
  test("tenant is redirected off dashboard and cannot list properties", async ({ page }) => {
    test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set PLAYWRIGHT_TENANT_EMAIL/PASSWORD to run this test.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(TENANT_EMAIL);
    await page.getByPlaceholder("Password").fill(TENANT_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("**/favourites", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/favourites/);

    // Browse page should not show the list CTA for tenants
    await page.goto("/properties");
    await expect(page.getByRole("button", { name: /List a property/i })).toHaveCount(0);

    // Tenant hitting owner route should be redirected away
    await page.goto("/dashboard/properties/new");
    await expect(page).not.toHaveURL(/\/dashboard\/properties\/new/);
    await expect(page.url()).toMatch(/favourites|auth\/login|forbidden/i);
  });
});
