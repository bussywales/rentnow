import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";
import {
  issueSubscriptionCreditsIfNeeded,
  upsertSubscriptionRecord,
} from "@/lib/billing/subscription-credits.server";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const HAS_SERVICE_ROLE = !!supabaseUrl && !!serviceRoleKey;

const TEMP_PASSWORD = "Test1234!";

let adminClient: SupabaseClient | null = null;
let tempUserId: string | null = null;
let tempEmail: string | null = null;
let subscriptionId: string | null = null;
let expectedListingCredits = 0;
let expectedFeaturedCredits = 0;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|profile|host/i, { timeout: 15_000 });
}

test.describe.serial("subscription credits", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !HAS_SERVICE_ROLE) return;
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `subscription-credits-${Date.now()}@example.com`;
    const created = await adminClient.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    tempUserId = created.data?.user?.id ?? null;
    tempEmail = email;

    if (!tempUserId) return;

    await adminClient.from("profiles").upsert({
      id: tempUserId,
      role: "agent",
      full_name: "Subscription Agent",
      agent_slug: `agent-sub-${Date.now()}`,
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

    const { data: planRow } = await adminClient
      .from("plans")
      .select("id, listing_credits, featured_credits")
      .eq("role", "agent")
      .eq("tier", "starter")
      .eq("is_active", true)
      .maybeSingle();

    expectedListingCredits = Math.max(0, planRow?.listing_credits ?? 0);
    expectedFeaturedCredits = Math.max(0, planRow?.featured_credits ?? 0);

    if (expectedListingCredits <= 0 && expectedFeaturedCredits <= 0) return;

    await adminClient.from("listing_credits").delete().eq("user_id", tempUserId);
    await adminClient.from("featured_credits").delete().eq("user_id", tempUserId);

    const now = new Date();
    const periodStart = now.toISOString();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subscription = await upsertSubscriptionRecord({
      adminClient,
      userId: tempUserId,
      provider: "playwright",
      providerSubscriptionId: `sub_${Date.now()}`,
      status: "active",
      planTier: "starter",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    subscriptionId = subscription?.id ?? null;

    if (subscriptionId) {
      await issueSubscriptionCreditsIfNeeded({
        adminClient,
        subscriptionId,
        userId: tempUserId,
        planTier: "starter",
        periodStart,
        periodEnd,
        subscriptionsEnabled: true,
      });
    }
  });

  test.afterAll(async () => {
    if (!adminClient || !tempUserId) return;
    if (subscriptionId) {
      await adminClient
        .from("subscription_credit_issues")
        .delete()
        .eq("subscription_id", subscriptionId);
      await adminClient.from("subscriptions").delete().eq("id", subscriptionId);
    }
    await adminClient.from("listing_credits").delete().eq("user_id", tempUserId);
    await adminClient.from("featured_credits").delete().eq("user_id", tempUserId);
    await adminClient.auth.admin.deleteUser(tempUserId);
  });

  test("issued subscription credits appear on billing page", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping.");
    test.skip(!tempEmail || !tempUserId, "Unable to create temp agent user.");
    test.skip(
      expectedListingCredits <= 0 && expectedFeaturedCredits <= 0,
      "Plan has zero credits; skipping."
    );

    await login(page, tempEmail!, TEMP_PASSWORD);
    await page.goto("/dashboard/billing");

    await expect(page.getByTestId("billing-listing-credits")).toHaveText(
      `${expectedListingCredits}/${expectedListingCredits}`
    );
    await expect(page.getByTestId("billing-featured-credits")).toHaveText(
      `${expectedFeaturedCredits}/${expectedFeaturedCredits}`
    );
  });
});
