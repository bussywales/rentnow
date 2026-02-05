import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

const TEMP_PASSWORD = "Test1234!";
let adminClient: SupabaseClient | null = null;
let tempUserId: string | null = null;
let tempUserEmail: string | null = null;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home|host/i, { timeout: 15_000 });
}

test.describe.serial("profile self-upsert", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE) return;
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `profile-missing-${Date.now()}@example.com`;
    const created = await adminClient.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    tempUserId = created.data?.user?.id ?? null;
    tempUserEmail = email;

    if (tempUserId) {
      await adminClient.from("profiles").delete().eq("id", tempUserId);
    }
  });

  test.afterAll(async () => {
    if (!adminClient || !tempUserId) return;
    await adminClient.auth.admin.deleteUser(tempUserId);
  });

  test("profile page self-creates missing profile", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping profile test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping profile test.");
    test.skip(!tempUserEmail, "Unable to create temp user; skipping profile test.");

    await login(page, tempUserEmail, TEMP_PASSWORD);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.locator("text=/unable to load profile/i")).toHaveCount(0);
  });
});

test("logged-in user can update profile display name", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping profile test.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  const nameInput = page.getByPlaceholder("Your name");
  const original = await nameInput.inputValue();
  const nextName = original ? `${original} QA` : "QA Profile";

  await nameInput.fill(nextName);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();

  await page.reload();
  await expect(nameInput).toHaveValue(nextName);

  await nameInput.fill(original);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
});

test("logged-out users are redirected to login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/auth\/login\?reason=auth/);
});
