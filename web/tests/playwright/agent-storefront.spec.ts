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
  await page.waitForURL(/admin|dashboard|tenant\/home|host/i, { timeout: 15_000 });
}

async function ensureAgentSlug(page: Page, displayName: string) {
  const response = await page.request.post("/api/profile/agent-storefront", {
    data: { displayName },
  });
  if (!response.ok()) return null;
  const data = await response.json();
  return typeof data?.slug === "string" ? data.slug : null;
}

async function readSlugFromProfile(page: Page) {
  const urlInput = page.getByTestId("agent-storefront-url");
  if ((await urlInput.count()) === 0) return null;
  const value = await urlInput.inputValue();
  return value.split("/").pop() || null;
}

async function readStorefrontUrlFromProfile(page: Page) {
  const urlInput = page.getByTestId("agent-storefront-url");
  if ((await urlInput.count()) === 0) return null;
  return urlInput.inputValue();
}

test.describe.serial("agent storefront", () => {
test("logged-out visitors can view agent storefronts", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
  test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping agent storefront test.");

  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");

  const toggle = page.getByTestId("agent-storefront-toggle");
  await expect(toggle).toBeVisible();
  if (!(await toggle.isChecked())) {
    await toggle.check();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  }

  const slug = (await ensureAgentSlug(page, "Agent")) || (await readSlugFromProfile(page));
  test.skip(!slug, "Unable to resolve agent slug for storefront test.");

  const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
  const userId = userResult.data?.user?.id ?? null;
  test.skip(!userId, "Unable to resolve agent id for storefront test.");

  const now = Date.now();
  const propertyTitle = `Storefront listing ${now}`;
  const approvedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

  let propertyId: string | null = null;
  try {
    const insert = await adminClient
      .from("properties")
      .insert({
        owner_id: userId,
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
    test.skip(!propertyId, insert.error?.message || "Failed to create test listing.");

    await page.goto("/auth/logout");
    await page.goto(`/agents/${slug}`);
    await expect(page.getByTestId("agent-storefront-contact")).toBeVisible();
    await expect(page.getByTestId("agent-storefront-share")).toBeVisible();
    await expect(page.getByTestId("agent-storefront-listings")).toBeVisible();
    await expect(page.getByText(propertyTitle)).toBeVisible();
  } finally {
    if (propertyId) {
      await adminClient.from("properties").delete().eq("id", propertyId);
    }
  }
});

test("storefront shows empty state when no live listings", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
  test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping agent storefront test.");

  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");

  const slug = (await ensureAgentSlug(page, "Agent")) || (await readSlugFromProfile(page));
  test.skip(!slug, "Unable to resolve agent slug for storefront test.");

  const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
  const userId = userResult.data?.user?.id ?? null;
  test.skip(!userId, "Unable to resolve agent id for storefront test.");

  const { data: liveListings } = await adminClient
    .from("properties")
    .select("id,status,paused_at")
    .eq("owner_id", userId)
    .eq("status", "live");

  const originalListings = (liveListings ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as string,
    paused_at: row.paused_at ?? null,
  }));

  try {
    if (originalListings.length > 0) {
      await adminClient
        .from("properties")
        .update({ status: "draft", paused_at: null })
        .in(
          "id",
          originalListings.map((row) => row.id)
        );
    }

    await page.goto("/auth/logout");
    await page.goto(`/agents/${slug}`);
    await expect(page.getByText("No live listings right now")).toBeVisible();
    await expect(page.getByRole("button", { name: /contact agent/i })).toBeVisible();
  } finally {
    if (originalListings.length > 0) {
      for (const listing of originalListings) {
        await adminClient
          .from("properties")
          .update({ status: listing.status, paused_at: listing.paused_at })
          .eq("id", listing.id);
      }
    }
  }
});

test("global storefront setting disables public pages", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/settings");

  const card = page.getByTestId("admin-setting-agent_storefronts_enabled");
  await expect(card).toBeVisible();

  const toggle = card.getByRole("button", { name: /Enable|Disable/i });
  const toggleLabel = await toggle.textContent();
  const wasEnabled = toggleLabel?.toLowerCase().includes("disable") ?? false;

  if (wasEnabled) {
    await toggle.click();
    await expect(card.getByText("Updated.")).toBeVisible();
  }

  await page.goto("/agents/preview-agent");
  await expect(page.getByTestId("agent-storefront-unavailable")).toBeVisible();
  await expect(page.getByText(/Agent storefronts are currently unavailable/i)).toBeVisible();

  if (wasEnabled) {
    await page.goto("/admin/settings");
    await card.getByRole("button", { name: /Enable/i }).click();
    await expect(card.getByText("Updated.")).toBeVisible();
  }
});

test("agent can hide storefront from public", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");

  const toggle = page.getByTestId("agent-storefront-toggle");
  await expect(toggle).toBeVisible();

  const slug = (await ensureAgentSlug(page, "Agent")) || (await readSlugFromProfile(page));
  test.skip(!slug, "Unable to resolve agent slug for storefront test.");

  if (await toggle.isChecked()) {
    await toggle.uncheck();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  }

  await page.goto("/auth/logout");
  await page.goto(`/agents/${slug}`);
  await expect(page.getByTestId("agent-storefront-unavailable")).toBeVisible();
  await expect(page.getByText(/This storefront is not available/i)).toBeVisible();

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");
  const toggleBack = page.getByTestId("agent-storefront-toggle");
  if (!(await toggleBack.isChecked())) {
    await toggleBack.check();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  }
});

test("agent can view their storefront when enabled", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");

  const toggle = page.getByTestId("agent-storefront-toggle");
  await expect(toggle).toBeVisible();
  if (!(await toggle.isChecked())) {
    await toggle.check();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  }

  const slug = (await ensureAgentSlug(page, "Agent")) || (await readSlugFromProfile(page));
  const storefrontUrl = await readStorefrontUrlFromProfile(page);
  test.skip(!slug || !storefrontUrl, "Unable to resolve agent storefront URL.");

  await page.goto(storefrontUrl);
  await expect(page.getByTestId("agent-storefront-listings")).toBeVisible();
});

test("storefront renders with missing optional profile fields", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping agent storefront test.");
  test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");
  test.skip(!HAS_SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing; skipping agent storefront test.");

  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
  await page.goto("/profile");

  const slug = (await ensureAgentSlug(page, "Agent")) || (await readSlugFromProfile(page));
  test.skip(!slug, "Unable to resolve agent slug for storefront test.");

  const userResult = await adminClient.auth.admin.getUserByEmail(AGENT_EMAIL);
  const userId = userResult.data?.user?.id ?? null;
  test.skip(!userId, "Unable to resolve agent id for storefront test.");

  const { data: original } = await adminClient
    .from("profiles")
    .select(
      "display_name, full_name, business_name, avatar_url, agent_bio, agent_slug, agent_storefront_enabled"
    )
    .eq("id", userId)
    .maybeSingle();

  await adminClient
    .from("profiles")
    .update({
      display_name: null,
      full_name: null,
      business_name: null,
      avatar_url: null,
      agent_bio: null,
      agent_storefront_enabled: true,
      agent_slug: slug,
    })
    .eq("id", userId);

  await page.goto("/auth/logout");
  await page.goto(`/agents/${slug}`);
  await expect(page.getByRole("heading", { name: /agent/i })).toBeVisible();
  await expect(page.getByTestId("agent-storefront-listings")).toBeVisible();

  if (original) {
    await adminClient.from("profiles").update(original).eq("id", userId);
  }
});
});
