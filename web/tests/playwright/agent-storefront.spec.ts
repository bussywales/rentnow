import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;

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

test("logged-out visitors can view agent storefronts", async ({ page }) => {
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
  test.skip(!slug, "Unable to resolve agent slug for storefront test.");

  await page.goto("/auth/logout");
  await page.goto(`/agents/${slug}`);
  await expect(page.getByTestId("agent-storefront-listings")).toBeVisible();
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
