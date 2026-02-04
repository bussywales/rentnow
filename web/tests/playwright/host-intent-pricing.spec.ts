import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites|tenant)/, { timeout: 15_000 });
}

test("host listing intent labels and pricing are context-aware (skip-safe)", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host intent pricing test.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run host intent pricing test.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await page.goto("/dashboard/properties/new");

  const intentSelect = page.getByLabel("Listing intent");
  const options = await intentSelect.locator("option").allTextContents();
  expect(options).toContain("Rent/Lease");
  expect(options).toContain("Sell (For Sale)");

  await intentSelect.selectOption("buy");
  await expect(page.getByText("Rent period")).toHaveCount(0);
  await expect(page.getByText("Sale listings use a total price.")).toBeVisible();

  await intentSelect.selectOption("rent");
  await expect(page.getByText("Rent period")).toBeVisible();
});
