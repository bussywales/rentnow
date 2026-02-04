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

test("host sees listing nudges when basics are incomplete (skip-safe)", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host listing nudge test.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run host listing nudge test.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await page.goto("/dashboard/properties/new");

  await expect(page.getByTestId("listing-nudges")).toBeVisible();
  await expect(page.getByTestId("listing-nudge-item").first()).toBeVisible();
});
