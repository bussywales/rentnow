import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const landlordEmail = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const landlordPassword = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";

const HAS_LANDLORD = !!landlordEmail && !!landlordPassword;

let adminClient: SupabaseClient | null = null;
let ownerId: string | null = null;
let listingId: string | null = null;
let originalPaygSetting: unknown = null;
let originalPaygAmount: unknown = null;
let originalLocationRequirement: unknown = null;
let originalCredits: Array<{ id: string; credits_used: number; credits_total: number }> = [];

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/host/, { timeout: 15_000 });
}

test.describe.serial("PAYG listing gate", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !serviceRoleKey || !HAS_LANDLORD) return;
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userResult = await adminClient.auth.admin.getUserByEmail(landlordEmail);
    ownerId = userResult.data?.user?.id ?? null;
    if (!ownerId) return;

    const settings = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", ["payg_enabled", "payg_listing_fee_amount", "require_location_pin_for_publish"]);
    originalPaygSetting =
      settings.data?.find((row) => row.key === "payg_enabled")?.value ?? null;
    originalPaygAmount =
      settings.data?.find((row) => row.key === "payg_listing_fee_amount")?.value ?? null;
    originalLocationRequirement =
      settings.data?.find((row) => row.key === "require_location_pin_for_publish")?.value ?? null;

    await adminClient
      .from("app_settings")
      .upsert({ key: "payg_enabled", value: { enabled: true }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    await adminClient
      .from("app_settings")
      .upsert({ key: "payg_listing_fee_amount", value: { value: 2000 }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    await adminClient
      .from("app_settings")
      .upsert({ key: "require_location_pin_for_publish", value: { enabled: false }, updated_at: new Date().toISOString() }, { onConflict: "key" });

    const credits = await adminClient
      .from("listing_credits")
      .select("id, credits_used, credits_total")
      .eq("user_id", ownerId);
    originalCredits = (credits.data as typeof originalCredits) ?? [];
    await Promise.all(
      originalCredits.map((row) =>
        adminClient
          .from("listing_credits")
          .update({ credits_used: row.credits_total, updated_at: new Date().toISOString() })
          .eq("id", row.id)
      )
    );

    const { data: versions } = await adminClient
      .from("legal_versions")
      .select("document_id, audience, version, jurisdiction")
      .in("audience", ["MASTER", "AUP", "DISCLAIMER", "LANDLORD_AGENT"]);
    if (versions?.length) {
      await adminClient.from("legal_acceptances").upsert(
        versions.map((row) => ({
          user_id: ownerId,
          document_id: row.document_id,
          audience: row.audience,
          jurisdiction: row.jurisdiction,
          version: row.version,
          accepted_at: new Date().toISOString(),
          ip: "127.0.0.1",
          user_agent: "playwright",
        })),
        { onConflict: "user_id,jurisdiction,audience,version" }
      );
    }

    const insert = await adminClient
      .from("properties")
      .insert({
        owner_id: ownerId,
        title: `PAYG test ${Date.now()}`,
        city: "Lagos",
        rental_type: "long_term",
        listing_intent: "rent",
        price: 2000,
        currency: "NGN",
        bedrooms: 1,
        bathrooms: 1,
        furnished: false,
        status: "draft",
        is_active: false,
        is_approved: false,
      })
      .select("id")
      .maybeSingle();

    listingId = insert.data?.id ?? null;
  });

  test.afterAll(async () => {
    if (!adminClient || !HAS_SUPABASE_ENV || !serviceRoleKey) return;
    if (listingId) {
      await adminClient.from("properties").delete().eq("id", listingId);
    }
    if (ownerId && originalCredits.length) {
      await Promise.all(
        originalCredits.map((row) =>
          adminClient
            .from("listing_credits")
            .update({ credits_used: row.credits_used, updated_at: new Date().toISOString() })
            .eq("id", row.id)
        )
      );
    }
    if (originalPaygSetting !== null) {
      await adminClient
        .from("app_settings")
        .update({ value: originalPaygSetting, updated_at: new Date().toISOString() })
        .eq("key", "payg_enabled");
    }
    if (originalPaygAmount !== null) {
      await adminClient
        .from("app_settings")
        .update({ value: originalPaygAmount, updated_at: new Date().toISOString() })
        .eq("key", "payg_listing_fee_amount");
    }
    if (originalLocationRequirement !== null) {
      await adminClient
        .from("app_settings")
        .update({ value: originalLocationRequirement, updated_at: new Date().toISOString() })
        .eq("key", "require_location_pin_for_publish");
    }
  });

  test("host sees payg modal when out of credits", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping payg gate test.");
    test.skip(!serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY missing; skipping payg gate test.");
    test.skip(!HAS_LANDLORD, "Landlord credentials missing.");
    test.skip(!listingId, "Listing setup failed.");

    await login(page, landlordEmail, landlordPassword);
    await page.goto(`/dashboard/properties/${listingId}?step=submit`);
    await page.getByRole("button", { name: /submit for approval/i }).click();

    const modal = page.getByTestId("payg-modal");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("payg-modal-pay")).toBeVisible();
  });
});
