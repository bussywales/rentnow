import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const landlordEmail = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const landlordPassword = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";

const HAS_LANDLORD = !!landlordEmail && !!landlordPassword;

let adminClient: SupabaseClient | null = null;
let ownerId: string | null = null;
let propertyId: string | null = null;
let propertyTitle = "";
let originalShowExpired: unknown = null;
let setupError: string | null = null;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/host/, { timeout: 15_000 });
}

test.describe.serial("Listing expiry + renewal", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !serviceRoleKey || !HAS_LANDLORD) return;
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userResult = await adminClient.auth.admin.getUserByEmail(landlordEmail);
    ownerId = userResult.data?.user?.id ?? null;
    if (!ownerId) {
      setupError = "Unable to resolve landlord user id.";
      return;
    }

    const settingResult = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "show_expired_listings_public")
      .maybeSingle();
    originalShowExpired = settingResult.data?.value ?? null;

    const now = Date.now();
    propertyTitle = `Expiry test ${now}`;
    const expiresAt = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const approvedAt = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

    const insert = await adminClient
      .from("properties")
      .insert({
        owner_id: ownerId,
        title: propertyTitle,
        city: "Test City",
        rental_type: "long_term",
        price: 1000,
        currency: "USD",
        bedrooms: 1,
        bathrooms: 1,
        furnished: false,
        status: "live",
        is_active: true,
        is_approved: true,
        approved_at: approvedAt,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();

    propertyId = insert.data?.id ?? null;
    if (!propertyId) {
      setupError = insert.error?.message || "Failed to insert test property.";
    }
  });

  test.afterAll(async () => {
    if (!adminClient || !HAS_SUPABASE_ENV || !serviceRoleKey) return;

    if (propertyId) {
      await adminClient.from("properties").delete().eq("id", propertyId);
    }

    if (originalShowExpired !== null) {
      await adminClient
        .from("app_settings")
        .update({ value: originalShowExpired, updated_at: new Date().toISOString() })
        .eq("key", "show_expired_listings_public");
    }
  });

  test("expired listing hidden publicly; host renews; public visible", async ({ browser }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping expiry renewal test.");
    test.skip(!serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY missing; skipping expiry renewal test.");
    test.skip(!HAS_LANDLORD, "Landlord credentials missing; skipping expiry renewal test.");
    test.skip(!!setupError, setupError || "Setup failed.");

    if (!adminClient || !propertyId) return;

    await adminClient
      .from("app_settings")
      .update({ value: { enabled: false }, updated_at: new Date().toISOString() })
      .eq("key", "show_expired_listings_public");

    await adminClient
      .from("properties")
      .update({
        status: "expired",
        is_active: false,
        expired_at: new Date().toISOString(),
      })
      .eq("id", propertyId);

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/properties/${propertyId}`);
    await expect(publicPage.getByText(/listing not found/i)).toBeVisible();
    await publicContext.close();

    const landlordContext = await browser.newContext();
    const landlordPage = await landlordContext.newPage();
    await login(landlordPage, landlordEmail, landlordPassword);
    await landlordPage.goto("/host");

    await landlordPage.getByPlaceholder("Search by title or area").fill(propertyTitle);
    await expect(landlordPage.getByText(propertyTitle)).toBeVisible();

    const renewButton = landlordPage.getByRole("button", { name: /renew listing/i });
    await expect(renewButton).toBeVisible();
    await renewButton.click();
    await expect(renewButton).toBeHidden({ timeout: 15_000 });

    await landlordContext.close();

    const publicContextAfter = await browser.newContext();
    const publicPageAfter = await publicContextAfter.newPage();
    await publicPageAfter.goto(`/properties/${propertyId}`);
    await expect(publicPageAfter.getByText(propertyTitle)).toBeVisible();
    await publicContextAfter.close();
  });

  test("expired listing URL accessible when public toggle enabled (read-only)", async ({ browser }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping expiry visibility test.");
    test.skip(!serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY missing; skipping expiry visibility test.");
    test.skip(!HAS_LANDLORD, "Landlord credentials missing; skipping expiry visibility test.");
    test.skip(!!setupError, setupError || "Setup failed.");

    if (!adminClient || !propertyId) return;

    await adminClient
      .from("properties")
      .update({
        status: "expired",
        is_active: false,
        expired_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", propertyId);

    await adminClient
      .from("app_settings")
      .update({ value: { enabled: true }, updated_at: new Date().toISOString() })
      .eq("key", "show_expired_listings_public");

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/properties/${propertyId}`);
    await expect(
      publicPage.getByText(/listing has expired and is no longer available/i)
    ).toBeVisible();
    await expect(publicPage.getByRole("button", { name: /request viewing/i })).toHaveCount(0);
    await publicContext.close();
  });
});
