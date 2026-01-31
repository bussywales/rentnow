import { test, expect } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const PROPERTY_ID = process.env.E2E_PUBLIC_PROPERTY_ID || "";

test("public property page shows trust identity pill (skip-safe)", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping public trust pill.");
  test.skip(!PROPERTY_ID, "Set E2E_PUBLIC_PROPERTY_ID to run public trust pill test.");

  await page.goto(`/properties/${PROPERTY_ID}`);
  await expect(page.getByTestId("trust-identity-pill")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/email not verified/i)).toHaveCount(0);
  await expect(page.getByText(/phone not verified/i)).toHaveCount(0);
  await expect(page.getByText(/bank not verified/i)).toHaveCount(0);
});
