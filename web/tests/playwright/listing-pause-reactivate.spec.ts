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
let setupError: string | null = null;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/host/, { timeout: 15_000 });
}

test.describe.serial("Listing pause/reactivate", () => {
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

    const now = Date.now();
    propertyTitle = `Pause test ${now}`;
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    const insert = await adminClient
      .from("properties")
      .insert({
        owner_id: ownerId,
        title: propertyTitle,
        city: "Test City",
        rental_type: "long_term",
        price: 1500,
        currency: "USD",
        bedrooms: 2,
        bathrooms: 1,
        furnished: false,
        status: "live",
        is_active: true,
        is_approved: true,
        approved_at: approvedAt,
        expires_at: expiresAt,
        latitude: 6.45,
        longitude: 3.39,
        location_label: "Test City",
      })
      .select("id")
      .maybeSingle();

    propertyId = insert.data?.id ?? null;
    if (!propertyId) {
      setupError = insert.error?.message || "Failed to insert test property.";
    }
  });

  test.afterAll(async () => {
    if (!adminClient) return;
    if (propertyId) {
      await adminClient.from("properties").delete().eq("id", propertyId);
    }
  });

  test("host can pause and reactivate listing", async ({ browser }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping listing pause test.");
    test.skip(!serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY missing; skipping listing pause test.");
    test.skip(!HAS_LANDLORD, "Landlord credentials missing; skipping listing pause test.");
    test.skip(!!setupError, setupError || "Setup failed.");

    if (!propertyId) return;

    const landlordContext = await browser.newContext();
    const landlordPage = await landlordContext.newPage();
    await login(landlordPage, landlordEmail, landlordPassword);

    await landlordPage.goto("/host/listings");
    await landlordPage.getByPlaceholder("Search by title or area").fill(propertyTitle);
    await expect(landlordPage.getByText(propertyTitle)).toBeVisible();

    const pauseButton = landlordPage.getByTestId(`listing-pause-${propertyId}`);
    await expect(pauseButton).toBeVisible();
    await pauseButton.click();

    await expect(landlordPage.getByTestId("pause-listing-modal")).toBeVisible();
    await landlordPage.getByTestId("pause-listing-confirm").click();
    await expect(landlordPage.getByTestId("pause-listing-modal")).toHaveCount(0);
    await expect(landlordPage.getByTestId(`listing-status-${propertyId}`)).toContainText(/paused/i);

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/properties/${propertyId}`);
    await expect(publicPage.getByText(/listing not found/i)).toBeVisible();
    await publicContext.close();

    const reactivateButton = landlordPage.getByTestId(`listing-reactivate-${propertyId}`);
    await expect(reactivateButton).toBeVisible();
    await reactivateButton.click();
    await expect(landlordPage.getByTestId("reactivate-listing-modal")).toBeVisible();
    await landlordPage.getByTestId("reactivate-listing-confirm").click();
    await expect(landlordPage.getByTestId("reactivate-listing-modal")).toHaveCount(0);
    await expect(landlordPage.getByTestId(`listing-status-${propertyId}`)).toContainText(/live/i);

    await landlordContext.close();

    const publicContextAfter = await browser.newContext();
    const publicPageAfter = await publicContextAfter.newPage();
    await publicPageAfter.goto(`/properties/${propertyId}`);
    await expect(publicPageAfter.getByText(propertyTitle)).toBeVisible();
    await publicContextAfter.close();
  });
});
