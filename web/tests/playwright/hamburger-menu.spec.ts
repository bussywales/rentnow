import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home/i, { timeout: 15_000 });
}

test("hamburger menu shows logged-out items", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("banner").getByRole("button", { name: /get started/i });
  const desktopHamburger = page.getByTestId("hamburger-menu");
  await expect(desktopHamburger).toBeVisible();
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
  const ctaBox = await cta.boundingBox();
  const hamburgerBox = await desktopHamburger.boundingBox();
  if (ctaBox && hamburgerBox) {
    expect(ctaBox.x).toBeLessThan(hamburgerBox.x);
  }
  await desktopHamburger.click();
  await expect(page.getByTestId("menu-item-help")).toBeVisible();
  await expect(page.getByTestId("menu-item-become-host")).toBeVisible();
  await expect(page.getByTestId("menu-item-agents")).toBeVisible();
  await expect(page.getByTestId("menu-item-login")).toBeVisible();
  await expect(page.getByTestId("menu-item-signup")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
});

test("hamburger menu shows admin items when logged in", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin menu check.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByTestId("hamburger-menu").click();
  await expect(page.getByTestId("menu-item-admin")).toBeVisible();
  await expect(page.getByTestId("hamburger-admin-insights")).toBeVisible();
  await expect(page.getByTestId("menu-item-updates")).toBeVisible();
  await expect(page.getByTestId("menu-item-ops-docs")).toBeVisible();
  await expect(page.getByTestId("menu-item-settings")).toBeVisible();
  await expect(page.getByTestId("menu-item-logout")).toBeVisible();
});

test("hamburger menu hides admin insights for tenant", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping tenant menu check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  const topHomeLinks = page.locator("header nav a", { hasText: "Home" });
  await expect(topHomeLinks).toHaveCount(1);
  await page.getByTestId("hamburger-menu").click();

  await expect(page.getByTestId("hamburger-admin-insights")).toHaveCount(0);
  await expect(page.getByTestId("menu-item-home")).toBeVisible();
});

test("host header has no My dashboard action", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host menu check.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await expect(page.getByRole("link", { name: "My dashboard" })).toHaveCount(0);
});

test("tenant sees a single hamburger at mobile and desktop widths", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping tenant menu check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/tenant/home");

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);

  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
});
