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

test("admin can view help centre and listings workflow", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin help docs test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/help/admin");
  await expect(page.getByTestId("help-admin-landing")).toBeVisible();
  await expect(page.getByTestId("help-common-tasks")).toBeVisible();

  await page.goto("/help/admin/listings/review-workflow");
  await expect(page.getByTestId("help-listings-review-workflow")).toBeVisible();
  await expect(page.getByRole("heading", { name: /review checklist/i })).toBeVisible();
});

test("admin can view listings statuses", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin help statuses test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/help/admin/listings/statuses");
  await expect(page.getByRole("heading", { name: /Listings statuses/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Live/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Expired/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Paused \(Occupied/i })).toBeVisible();
});

test("admin can view featured listings guide", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin featured guide test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/help/admin/listings/featured");
  await expect(page.getByRole("heading", { name: /Featured listings/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /What featured listings are/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Featured ranking logic/i })).toBeVisible();
});

test("admin can view analytics guide", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin analytics guide test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/help/admin/analytics");
  await expect(page.getByRole("heading", { name: /Analytics, demand, and performance/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Events and signals tracked/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Missed demand/i })).toBeVisible();
});

test("admin can view support playbooks", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin playbooks test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/help/admin/support-playbooks");
  await expect(page.getByTestId("help-playbooks-landing")).toBeVisible();

  await page.getByRole("link", { name: /Login & access/i }).click();
  await expect(page.getByRole("heading", { name: /Login & access issues/i })).toBeVisible();
});

test("non-admin is blocked from admin help", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping non-admin help check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/help/admin");

  await expect(page).toHaveURL(/forbidden|auth\/required/i);
});
