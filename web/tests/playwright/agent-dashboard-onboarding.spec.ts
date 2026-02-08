import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

const TEMP_PASSWORD = "Test1234!";

let adminClient: SupabaseClient | null = null;
let tempUserId: string | null = null;
let tempEmail: string | null = null;
let listingId: string | null = null;
let clientPageId: string | null = null;
let agentSlug: string | null = null;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|profile|host/i, { timeout: 15_000 });
}

test.describe.serial("agent onboarding checklist", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE) return;
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `agent-onboarding-${Date.now()}@example.com`;
    const created = await adminClient.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    tempUserId = created.data?.user?.id ?? null;
    tempEmail = email;

    if (tempUserId) {
      agentSlug = `agent-onboard-${Date.now()}`;
      await adminClient.from("profiles").upsert({
        id: tempUserId,
        role: "agent",
        full_name: "Agent Onboarding",
        agent_slug: agentSlug,
      });

      const { data: versions } = await adminClient
        .from("legal_versions")
        .select("document_id, audience, version, jurisdiction")
        .in("audience", ["MASTER", "AUP", "DISCLAIMER", "LANDLORD_AGENT"]);
      if (versions?.length) {
        await adminClient.from("legal_acceptances").upsert(
          versions.map((row) => ({
            user_id: tempUserId,
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
    }
  });

  test.afterAll(async () => {
    if (!adminClient || !tempUserId) return;
    if (clientPageId) {
      await adminClient.from("agent_client_pages").delete().eq("id", clientPageId);
    }
    if (listingId) {
      await adminClient.from("properties").delete().eq("id", listingId);
    }
    await adminClient.auth.admin.deleteUser(tempUserId);
  });

  test("agent sees checklist and completes it", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");
    test.skip(!tempEmail || !tempUserId, "Unable to create temp agent user.");

    await login(page, tempEmail, TEMP_PASSWORD);
    await page.goto("/dashboard/analytics");

    await expect(page.getByRole("link", { name: "Client pages" })).toBeVisible();
    await expect(page.getByTestId("agent-onboarding-card")).toBeVisible();

    const now = Date.now();
    const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

    const listingInsert = await adminClient!
      .from("properties")
      .insert({
        owner_id: tempUserId,
        title: `Checklist listing ${now}`,
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
        approved_at: approvedAt,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();
    listingId = listingInsert.data?.id ?? null;

    const clientSlug = `client-${now}`;
    const clientInsert = await adminClient!
      .from("agent_client_pages")
      .insert({
        agent_user_id: tempUserId,
        agent_slug: agentSlug,
        client_slug: clientSlug,
        client_name: "Checklist Client",
        published: true,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    clientPageId = clientInsert.data?.id ?? null;

    await page.reload();
    await expect(page.getByTestId("agent-onboarding-card")).toBeVisible();
    await page.getByTestId("agent-onboarding-share-cta").click();
    await expect(page.getByTestId("agent-onboarding-success")).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId("agent-onboarding-card")).toHaveCount(0);
  });
});
