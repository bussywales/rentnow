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
  const desktopHamburger = page.getByRole("button", { name: /open menu/i });
  await expect(desktopHamburger).toBeVisible();
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
  const ctaBox = await cta.boundingBox();
  const hamburgerBox = await desktopHamburger.boundingBox();
  if (ctaBox && hamburgerBox) {
    expect(ctaBox.x).toBeLessThan(hamburgerBox.x);
  }
  await desktopHamburger.click();
  await expect(page.getByRole("link", { name: "Help Centre" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Become a host" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find an agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
});

test("hamburger menu shows admin items when logged in", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping admin menu check.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);

  await page.getByRole("button", { name: /open menu/i }).click();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Insights" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Updates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Support" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Saved searches" })).toHaveCount(0);

  await page.getByRole("button", { name: /close menu/i }).click();
  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
});

test("hamburger menu hides admin insights for tenant", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping tenant menu check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  const topHomeLinks = page.locator("header nav a", { hasText: "Home" });
  await expect(topHomeLinks).toHaveCount(1);
  await page.getByRole("button", { name: /open menu/i }).click();

  await expect(page.getByRole("link", { name: "Insights" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});

test("host header has no My dashboard action", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host menu check.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await expect(page.getByRole("link", { name: "My dashboard" })).toHaveCount(0);
});

test("host sees a single hamburger with host-only items", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping host menu check.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test.");

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  await page.goto("/dashboard");

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
  await page.getByRole("button", { name: /open menu/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Insights" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Saved searches" })).toHaveCount(0);

  await page.getByRole("button", { name: /close menu/i }).click();
  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveCount(1);
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
