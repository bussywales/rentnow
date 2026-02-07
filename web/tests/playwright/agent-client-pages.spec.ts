import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;

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

test.describe.serial("agent client pages", () => {
  test("agent creates client page and shares link", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");

    const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/profile");

    const slug = await ensureAgentSlug(page, "Agent");
    test.skip(!slug, "Unable to resolve agent slug.");

    const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
    const userId = userResult.data?.user?.id ?? null;
    test.skip(!userId, "Unable to resolve agent id.");

    const now = Date.now();
    const propertyTitle = `Client page listing ${now}`;
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    let propertyId: string | null = null;
    let clientPageId: string | null = null;
    try {
      const insert = await adminClient
        .from("properties")
        .insert({
          owner_id: userId,
          title: propertyTitle,
          city: "Test City",
          rental_type: "long_term",
          listing_intent: "rent",
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
      test.skip(!propertyId, insert.error?.message || "Failed to create listing.");

      await page.goto("/profile/clients");
      await page.getByTestId("client-page-name").fill("Client Alpha");
      await page.getByTestId("client-page-title").fill("Homes picked for Client Alpha");
      await page.getByTestId("client-page-requirements").fill("Needs a two-bed in Test City.");
      await page.getByTestId("client-page-save").click();
      await expect(page.getByText("Client page created.")).toBeVisible();

      const row = page.getByTestId("client-page-row").first();
      await expect(row).toContainText("Client Alpha");
      const slugText = await row.getByTestId("client-page-slug").innerText();
      const clientSlug = slugText.replace("/", "").trim();

      await row.getByTestId(/client-page-copy/).click();
      await expect(page.getByText("Link copied to clipboard.")).toBeVisible();

      const { data: clientPageRow } = await adminClient
        .from("agent_client_pages")
        .select("id")
        .eq("agent_user_id", userId)
        .eq("client_slug", clientSlug)
        .maybeSingle();
      clientPageId = clientPageRow?.id ?? null;

      if (clientPageId) {
        await adminClient
          .from("agent_client_page_listings")
          .upsert(
            {
              client_page_id: clientPageId,
              property_id: propertyId,
              pinned: true,
              rank: 0,
            },
            { onConflict: "client_page_id,property_id" }
          );

        await adminClient
          .from("agent_client_pages")
          .update({ published: true, published_at: new Date().toISOString() })
          .eq("id", clientPageId);
      }

      await page.goto(`/agents/${slug}/c/${clientSlug}`);
      await expect(page.getByRole("heading", { name: /Homes shortlisted for Client Alpha/ })).toBeVisible();
      await expect(page.getByText(propertyTitle)).toBeVisible();
    } finally {
      if (clientPageId) {
        await adminClient.from("agent_client_pages").delete().eq("id", clientPageId);
      }
      if (propertyId) {
        await adminClient.from("properties").delete().eq("id", propertyId);
      }
    }
  });

  test("client page shows empty state when no matches", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/profile");

    const slug = await ensureAgentSlug(page, "Agent");
    test.skip(!slug, "Unable to resolve agent slug.");

    await page.goto("/profile/clients");
    await page.getByTestId("client-page-name").fill("Client Empty");
    await page.getByTestId("client-page-title").fill("Shortlist");
    await page.getByTestId("client-page-requirements").fill("No matches expected.");
    await page.getByTestId("client-page-published").check();
    await page.getByTestId("client-page-save").click();
    await expect(page.getByText("Client page created.")).toBeVisible();

    const row = page.getByTestId("client-page-row").first();
    const slugText = await row.getByTestId("client-page-slug").innerText();
    const clientSlug = slugText.replace("/", "").trim();

    await page.goto(`/agents/${slug}/c/${clientSlug}`);
    await expect(page.getByText("No matches right now")).toBeVisible();
    await expect(page.getByText(/Nothing matches this shortlist/i)).toBeVisible();

    if (HAS_SERVICE_ROLE) {
      const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: clientPageRow } = await adminClient
        .from("agent_client_pages")
        .select("id")
        .eq("agent_slug", slug)
        .eq("client_slug", clientSlug)
        .maybeSingle();
      if (clientPageRow?.id) {
        await adminClient.from("agent_client_pages").delete().eq("id", clientPageRow.id);
      }
    }
  });

  test("unpublished client page returns 404", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/profile");

    const slug = await ensureAgentSlug(page, "Agent");
    test.skip(!slug, "Unable to resolve agent slug.");

    await page.goto("/profile/clients");
    await page.getByTestId("client-page-name").fill("Client Draft");
    await page.getByTestId("client-page-requirements").fill("Draft requirements");
    await page.getByTestId("client-page-save").click();
    await expect(page.getByText("Client page created.")).toBeVisible();

    const row = page.getByTestId("client-page-row").first();
    const slugText = await row.getByTestId("client-page-slug").innerText();
    const clientSlug = slugText.replace("/", "").trim();

    await page.goto(`/agents/${slug}/c/${clientSlug}`);
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();

    if (HAS_SERVICE_ROLE) {
      const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: clientPageRow } = await adminClient
        .from("agent_client_pages")
        .select("id")
        .eq("agent_slug", slug)
        .eq("client_slug", clientSlug)
        .maybeSingle();
      if (clientPageRow?.id) {
        await adminClient.from("agent_client_pages").delete().eq("id", clientPageRow.id);
      }
    }
  });

  test("non-agent is blocked from client pages", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/profile/clients");
    await expect(page).toHaveURL(/forbidden/);

    const apiResponse = await page.request.get("/api/agent/client-pages");
    expect(apiResponse.status()).toBe(403);
  });
});
