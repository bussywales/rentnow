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
  await page.waitForURL(/\/(dashboard|favourites)/, { timeout: 15_000 });
}

test("host can select Hostel listing type in create flow (skip-safe)", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping listing type flow.");
  test.skip(
    !HAS_LANDLORD,
    "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run listing type flow."
  );

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await page.goto("/dashboard/properties/new");

  await page.getByLabel("Listing title").fill(`Hostel listing ${Date.now()}`);
  await page.getByLabel("City").fill("Lagos");
  await page.getByLabel("Price").fill("1200");
  await page.getByLabel("Bedrooms").fill("10");
  await page.getByLabel("Bathrooms").fill("5");
  await page.getByLabel("Furnished").check();
  await page.getByLabel("Listing type").selectOption("hostel");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: /details/i })).toBeVisible();

  await page.getByLabel("Description").fill("Student-friendly hostel close to campus.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Hostel").first()).toBeVisible({ timeout: 10_000 });
});
