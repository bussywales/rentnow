import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

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

test("expired client page returns 404", async ({ page }) => {
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

  await page.goto("/profile/clients");
  await page.getByTestId("client-page-name").fill("Client Expired");
  await page.getByTestId("client-page-requirements").fill("Expired requirements");
  await page.getByTestId("client-page-expires").fill("2026-02-01");
  await page.getByTestId("client-page-published").check();
  await page.getByTestId("client-page-save").click();
  await expect(page.getByText("Client page created.")).toBeVisible();

  const row = page.getByTestId("client-page-row").first();
  const slugText = await row.getByTestId("client-page-slug").innerText();
  const clientSlug = slugText.replace("/", "").trim();

  await page.goto(`/agents/${slug}/c/${clientSlug}`);
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();

  const { data: clientPageRow } = await adminClient
    .from("agent_client_pages")
    .select("id")
    .eq("agent_slug", slug)
    .eq("client_slug", clientSlug)
    .maybeSingle();
  if (clientPageRow?.id) {
    await adminClient.from("agent_client_pages").delete().eq("id", clientPageRow.id);
  }
});
