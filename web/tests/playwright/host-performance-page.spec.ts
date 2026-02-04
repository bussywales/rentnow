import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home|host/i, { timeout: 15_000 });
}

test("host can access performance page and use range selector", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host performance check.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run host performance check.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await page.goto("/host/performance");

  await expect(page.getByTestId("host-performance-table")).toBeVisible();
  await expect(page.getByText("Views")).toBeVisible();
  await expect(page.getByText("Enquiries")).toBeVisible();

  await page.getByTestId("host-performance-range-7").click();
  await expect(page).toHaveURL(/range=7/);
  await expect(page.getByTestId("host-performance-table")).toBeVisible();
});

test("tenant cannot access host performance", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host performance access check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run tenant access check.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/host/performance");
  await expect(page).toHaveURL(/tenant\/home|forbidden|auth\/required/i);
});
