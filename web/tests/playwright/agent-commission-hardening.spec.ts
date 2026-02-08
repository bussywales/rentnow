import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

let adminClient: SupabaseClient | null = null;
let agentId: string | null = null;
let listingId: string | null = null;
let agreementId: string | null = null;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin|profile|host|tenant/i, { timeout: 15_000 });
}

test.describe.serial("commission hardening", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE || !HAS_AGENT) return;

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const agentResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
    agentId = agentResult.data?.user?.id ?? null;

    if (!agentId) return;

    const now = Date.now();
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    const listingInsert = await adminClient
      .from("properties")
      .insert({
        owner_id: agentId,
        title: `Commission listing ${now}`,
        city: "Lagos",
        rental_type: "long_term",
        listing_intent: "rent",
        price: 4200,
        currency: "NGN",
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
        location_label: "Lagos",
      })
      .select("id")
      .maybeSingle();

    listingId = listingInsert.data?.id ?? null;

    if (listingId) {
      const agreementInsert = await adminClient
        .from("agent_commission_agreements")
        .insert({
          listing_id: listingId,
          owner_agent_id: agentId,
          presenting_agent_id: agentId,
          commission_type: "percentage",
          commission_value: 5,
          status: "proposed",
          notes: "Demo terms",
        })
        .select("id")
        .maybeSingle();

      agreementId = agreementInsert.data?.id ?? null;
    }
  });

  test.afterAll(async () => {
    if (!adminClient) return;
    if (agreementId) {
      await adminClient.from("agent_commission_events").delete().eq("agreement_id", agreementId);
      await adminClient.from("agent_commission_agreements").delete().eq("id", agreementId);
    }
    if (listingId) {
      await adminClient.from("properties").delete().eq("id", listingId);
    }
  });

  test("agent accepts and voids agreement", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");
    test.skip(!agreementId, "Agreement seed missing; skipping.");

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/dashboard/collaborations");

    await expect(page.getByTestId(`commission-row-${agreementId}`)).toBeVisible();
    await page.getByTestId(`commission-accept-${agreementId}`).click();
    await expect(page.getByText(/Accepted/)).toBeVisible();

    await page.getByTestId(`commission-void-${agreementId}`).click();
    await expect(page.getByTestId("commission-void-reason")).toBeVisible();
    await page.getByTestId("commission-void-confirm").click();
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
    await page.getByTestId("commission-void-reason").fill("Client cancelled before close.");
    await page.getByTestId("commission-void-confirm").click();
    await expect(page.getByText(/Voided/)).toBeVisible();

    if (HAS_ADMIN) {
      const adminPage = await page.context().newPage();
      await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
      await adminPage.goto("/admin/commission-agreements");
      await expect(adminPage.getByText(/Void reason/i)).toBeVisible();
    }
  });
});
