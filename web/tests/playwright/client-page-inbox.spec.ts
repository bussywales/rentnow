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

async function ensureAgentSlug(page: Page, displayName: string) {
  const response = await page.request.post("/api/profile/agent-storefront", {
    data: { displayName },
  });
  if (!response.ok()) return null;
  const data = await response.json();
  return typeof data?.slug === "string" ? data.slug : null;
}

test.describe.serial("client page inbox", () => {
  test("agent can manage enquiries per client page", async ({ page, context }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");

    const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const agentResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
    const agentId = agentResult.data?.user?.id ?? null;
    test.skip(!agentId, "Unable to resolve agent id.");

    const now = Date.now();
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    let propertyId: string | null = null;
    let clientPageId: string | null = null;
    let clientSlug: string | null = null;
    let leadId: string | null = null;

    try {
      const propertyInsert = await adminClient
        .from("properties")
        .insert({
          owner_id: agentId,
          title: `Client inbox lead ${now}`,
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

      await login(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto("/profile");
      const agentSlug = await ensureAgentSlug(page, "Agent");
      test.skip(!agentSlug, "Unable to resolve agent slug.");

      await page.goto("/profile/clients");
      await page.getByTestId("client-page-name").fill("Concierge Inbox");
      await page.getByTestId("client-page-requirements").fill("2-bed in Test City, budget 1500 USD.");
      await page.getByTestId("client-page-curated-select").selectOption(propertyId);
      await page.getByTestId("client-page-curated-add").click();
      await page.getByTestId("client-page-published").check();
      await page.getByTestId("client-page-save").click();
      await expect(page.getByText("Client page created.")).toBeVisible();

      const row = page.getByTestId("client-page-row").first();
      const slugText = await row.getByTestId("client-page-slug").innerText();
      clientSlug = slugText.replace("/", "").trim();

      const pageRow = await adminClient
        .from("agent_client_pages")
        .select("id")
        .eq("agent_user_id", agentId)
        .eq("client_slug", clientSlug)
        .maybeSingle();
      clientPageId = pageRow.data?.id ?? null;
      test.skip(!clientPageId, "Unable to resolve client page id.");

      const tenantPage = await context.newPage();
      await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD);
      await tenantPage.goto(`/agents/${agentSlug}/c/${clientSlug}`);
      await tenantPage.getByRole("heading", { name: /Homes shortlisted/i }).waitFor();
      await tenantPage.getByText("Client inbox lead").click();
      await tenantPage.getByRole("button", { name: /enquire to buy/i }).click();
      await tenantPage.getByLabel("Message").fill("Interested in this home, can we talk?");
      await tenantPage.getByLabel(/Keep communication/i).check();
      await tenantPage.getByRole("button", { name: /send enquiry/i }).click();

      const { data: leadRow } = await adminClient
        .from("listing_leads")
        .select("id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      leadId = leadRow?.id ?? null;
      test.skip(!leadId, "Unable to resolve created lead.");

      await page.goto(`/profile/clients/${clientPageId}/inbox`);
      await expect(page.getByTestId(`client-page-lead-row-${leadId}`)).toBeVisible();
      await page.getByTestId(`client-page-lead-row-${leadId}`).click();

      const statusSelect = page.getByTestId("client-page-lead-status");
      await statusSelect.selectOption("CONTACTED");
      await expect(statusSelect).toHaveValue("CONTACTED");

      await page.getByTestId("client-page-lead-note").fill("Followed up, awaiting reply.");
      await page.getByRole("button", { name: /add note/i }).click();
      await expect(page.getByTestId("client-page-lead-note-item")).toContainText("Followed up");
    } finally {
      if (leadId) {
        await adminClient.from("listing_leads").delete().eq("id", leadId);
      }
      if (clientPageId) {
        await adminClient.from("agent_client_pages").delete().eq("id", clientPageId);
      }
      if (propertyId) {
        await adminClient.from("properties").delete().eq("id", propertyId);
      }
    }
  });
});
