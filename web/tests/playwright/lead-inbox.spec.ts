import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";

const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home|host|profile/i, { timeout: 15_000 });
}

test.describe.serial("lead inbox", () => {
  test("agent can open drawer, add note, and update status", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");

    const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
    const userId = userResult.data?.user?.id ?? null;
    test.skip(!userId, "Unable to resolve agent id.");

    const now = Date.now();
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    let propertyId: string | null = null;
    let leadId: string | null = null;

    try {
      const propertyInsert = await adminClient
        .from("properties")
        .insert({
          owner_id: userId,
          title: `Inbox lead ${now}`,
          city: "Test City",
          rental_type: "long_term",
          listing_intent: "buy",
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

      propertyId = propertyInsert.data?.id ?? null;
      test.skip(!propertyId, propertyInsert.error?.message || "Failed to create property.");

      const leadInsert = await adminClient
        .from("listing_leads")
        .insert({
          property_id: propertyId,
          owner_id: userId,
          buyer_id: userId,
          status: "NEW",
          intent: "BUY",
          message: "Test lead message",
        })
        .select("id")
        .maybeSingle();

      leadId = leadInsert.data?.id ?? null;
      test.skip(!leadId, leadInsert.error?.message || "Failed to create lead.");

      await login(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto("/dashboard/leads");

      await page.getByTestId(`lead-row-${leadId}`).click();
      await expect(page.getByTestId("lead-drawer")).toBeVisible();

      await page.getByTestId("lead-note-input").fill("Follow up tomorrow");
      await page.getByTestId("lead-note-submit").click();
      await expect(page.getByText("Follow up tomorrow")).toBeVisible();

      await page.getByTestId("lead-status-select").selectOption("WON");
      await expect(page.getByTestId("lead-tab-count-won")).toHaveText("1");
    } finally {
      if (leadId) {
        await adminClient.from("listing_leads").delete().eq("id", leadId);
      }
      if (propertyId) {
        await adminClient.from("properties").delete().eq("id", propertyId);
      }
    }
  });

  test("tenant is blocked from lead notes", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");

    const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL || TENANT_EMAIL);
    const userId = userResult.data?.user?.id ?? null;
    test.skip(!userId, "Unable to resolve owner id.");

    const now = Date.now();
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    let propertyId: string | null = null;
    let leadId: string | null = null;

    try {
      const propertyInsert = await adminClient
        .from("properties")
        .insert({
          owner_id: userId,
          title: `Tenant lead ${now}`,
          city: "Test City",
          rental_type: "long_term",
          listing_intent: "buy",
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

      propertyId = propertyInsert.data?.id ?? null;
      test.skip(!propertyId, propertyInsert.error?.message || "Failed to create property.");

      const leadInsert = await adminClient
        .from("listing_leads")
        .insert({
          property_id: propertyId,
          owner_id: userId,
          buyer_id: userId,
          status: "NEW",
          intent: "BUY",
          message: "Tenant lead message",
        })
        .select("id")
        .maybeSingle();

      leadId = leadInsert.data?.id ?? null;
      test.skip(!leadId, leadInsert.error?.message || "Failed to create lead.");

      await login(page, TENANT_EMAIL, TENANT_PASSWORD);
      await page.goto("/dashboard/leads");
      await expect(page).toHaveURL(/dashboard\/messages/);

      const response = await page.request.get(`/api/leads/${leadId}/notes`);
      expect([401, 403]).toContain(response.status());
    } finally {
      if (leadId) {
        await adminClient.from("listing_leads").delete().eq("id", leadId);
      }
      if (propertyId) {
        await adminClient.from("properties").delete().eq("id", propertyId);
      }
    }
  });
});
