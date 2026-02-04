import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home/i, { timeout: 15_000 });
}

test("admin can view insights dashboard", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping insights test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/insights");

  await expect(page.getByRole("heading", { name: /Insights/i })).toBeVisible();
  await expect(page.getByTestId("insights-growth")).toBeVisible();
});

test("non-admin is blocked from insights", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping insights access test.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/admin/insights");

  await expect(page).toHaveURL(/forbidden|auth\/required/i);
});
