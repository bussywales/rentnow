import { test, expect, type Page } from "@playwright/test";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard|admin|browse|properties/);
}

test.describe("Verification center", () => {
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run verification center tests.");

  test("loads verification center for hosts", async ({ page }) => {
    await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
    await page.goto("/dashboard/settings/verification");
    await expect(page.getByRole("heading", { name: "Identity verification" })).toBeVisible();
    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();
    await expect(page.getByText("Bank")).toBeVisible();
  });
});
