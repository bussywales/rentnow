import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const TENANT_EMAIL = process.env.PLAYWRIGHT_TENANT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD =
  process.env.PLAYWRIGHT_TENANT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD || "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("Role-based landing", () => {
  test("agent lands on /home", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing.");
    test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD.");

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.waitForURL("**/home", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured homes" })).toBeVisible();
  });

  test("landlord lands on /home", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing.");
    test.skip(!LANDLORD_EMAIL || !LANDLORD_PASSWORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD.");

    await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
    await page.waitForURL("**/home", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  });

  test("tenant lands on /tenant/home", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing.");
    test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set PLAYWRIGHT_TENANT_EMAIL/PASSWORD or PLAYWRIGHT_USER_EMAIL/PASSWORD.");

    await login(page, TENANT_EMAIL, TENANT_PASSWORD);
    await page.waitForURL("**/tenant/home", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Find your next home" })).toBeVisible();
  });
});
