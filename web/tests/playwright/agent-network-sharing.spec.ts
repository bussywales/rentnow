import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";

const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;
const HAS_ADMIN = !!ADMIN_EMAIL;

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

let adminClient: SupabaseClient | null = null;
let agentId: string | null = null;
let ownerId: string | null = null;
let listingId: string | null = null;
let listingTitle: string | null = null;
let clientPageId: string | null = null;
let clientSlug: string | null = null;
let agentSlug: string | null = null;
let originalFlag: unknown = null;

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

async function setNetworkFlag(enabled: boolean) {
  if (!adminClient) return;
  await adminClient
    .from("app_settings")
    .upsert(
      { key: "agent_network_discovery_enabled", value: { enabled }, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}

test.describe.serial("agent network sharing", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE || !HAS_AGENT) return;

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const agentResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
    agentId = agentResult.data?.user?.id ?? null;

    if (HAS_ADMIN) {
      const ownerResult = await adminClient.auth.admin.getUserByEmail(ADMIN_EMAIL);
      ownerId = ownerResult.data?.user?.id ?? null;
    }

    if (!ownerId) ownerId = agentId;

    const flagRow = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "agent_network_discovery_enabled")
      .maybeSingle();
    originalFlag = flagRow.data?.value ?? null;

    const now = Date.now();
    listingTitle = `Network listing ${now}`;
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    if (ownerId) {
      const insert = await adminClient
        .from("properties")
        .insert({
          owner_id: ownerId,
          title: listingTitle,
          city: "Lagos",
          rental_type: "long_term",
          listing_intent: "rent",
          price: 2500,
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

      listingId = insert.data?.id ?? null;
    }
  });

  test.afterAll(async () => {
    if (!adminClient || !HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE) return;
    if (clientPageId) {
      await adminClient.from("agent_listing_shares").delete().eq("client_page_id", clientPageId);
      await adminClient
        .from("agent_client_page_listings")
        .delete()
        .eq("client_page_id", clientPageId);
      await adminClient.from("agent_client_pages").delete().eq("id", clientPageId);
    }
    if (listingId) {
      await adminClient.from("properties").delete().eq("id", listingId);
    }
    if (originalFlag !== null) {
      await adminClient
        .from("app_settings")
        .update({ value: originalFlag, updated_at: new Date().toISOString() })
        .eq("key", "agent_network_discovery_enabled");
    } else {
      await adminClient.from("app_settings").delete().eq("key", "agent_network_discovery_enabled");
    }
  });

  test("agent can add external listing to client page", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");
    test.skip(!adminClient || !agentId || !listingId, "Missing setup state.");
    test.skip(!listingTitle, "Missing listing title.");

    await setNetworkFlag(true);

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/profile");
    agentSlug = await ensureAgentSlug(page, "Agent");
    test.skip(!agentSlug, "Unable to resolve agent slug.");

    const now = Date.now();
    clientSlug = `network-client-${now}`;
    const insert = await adminClient
      .from("agent_client_pages")
      .insert({
        agent_user_id: agentId,
        agent_slug: agentSlug,
        client_slug: clientSlug,
        client_name: "Network Client",
        published: true,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    clientPageId = insert.data?.id ?? null;
    test.skip(!clientPageId, "Unable to create client page.");

    await page.goto("/dashboard/agent-network");
    await page.getByRole("button", { name: /search/i }).click();
    await expect(page.getByText(listingTitle)).toBeVisible();
    await page.getByRole("button", { name: /add to client page/i }).first().click();

    const modal = page.getByRole("heading", { name: /Add listing to client page/i }).locator("..");
    await modal.locator("select").selectOption({ label: "Network Client" });
    await modal.getByRole("button", { name: /add listing/i }).click();
    await expect(page.getByText("Listing added to client page.")).toBeVisible();

    await page.goto(`/agents/${agentSlug}/c/${clientSlug}`);
    await expect(page.getByText(listingTitle)).toBeVisible();
    await expect(page.getByText(/Listed by/i)).toBeVisible();
  });

  test("flag disabled hides agent network", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");

    await setNetworkFlag(false);

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/dashboard/agent-network");
    await expect(page.getByText(/Agent Network Discovery is disabled/i)).toBeVisible();

    const apiResponse = await page.request.get("/api/agent/network/listings");
    expect(apiResponse.status()).toBe(403);

    await page.goto("/profile/clients");
    await expect(page.getByText("Add external listings")).toHaveCount(0);
  });
});
