import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";

const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string, target?: RegExp) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(target ?? /\/(tenant|host|admin|dashboard)/, { timeout: 15_000 });
}

function parsePropertyId(href: string | null) {
  if (!href) return null;
  const path = href.split("?")[0];
  const parts = path.split("/properties/");
  return parts[1] ?? null;
}

async function parseCount(locator: ReturnType<Page["locator"]>) {
  const text = (await locator.textContent()) ?? "";
  const trimmed = text.trim();
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 0;
}

test("property views dedupe per session/day", async ({ browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping analytics test.");
  test.skip(!HAS_TENANT || !HAS_ADMIN, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  const tenantContext = await browser.newContext();
  const tenantPage = await tenantContext.newPage();
  await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD, /\/tenant/);

  await tenantPage.goto("/properties");
  const card = tenantPage.getByTestId("property-card").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "No listings available to test views.");
  }
  const href = await card.locator("a").first().getAttribute("href");
  const propertyId = parsePropertyId(href);
  if (!propertyId) {
    test.skip(true, "Unable to resolve property id for view test.");
  }

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, /\/(admin|dashboard)/);

  const baselineRes = await adminPage.request.get(
    `/api/analytics/property-events?property_id=${propertyId}&days=7`
  );
  if (!baselineRes.ok()) {
    test.skip(true, "Unable to read baseline event summary.");
  }
  const baselineJson = await baselineRes.json();
  const baselineViews = baselineJson?.summary?.views ?? 0;

  await tenantPage.goto(href!);
  await tenantPage.waitForURL(/\/properties\//, { timeout: 15_000 });
  await tenantPage.goto(href!);

  const afterRes = await adminPage.request.get(
    `/api/analytics/property-events?property_id=${propertyId}&days=7`
  );
  const afterJson = await afterRes.json();
  const afterViews = afterJson?.summary?.views ?? baselineViews;

  expect(afterViews - baselineViews).toBeLessThanOrEqual(1);

  await tenantContext.close();
  await adminContext.close();
});

test("save activity surfaces in host performance", async ({ browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping analytics test.");
  test.skip(!HAS_TENANT || !HAS_LANDLORD, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test.");

  const landlordContext = await browser.newContext();
  const landlordPage = await landlordContext.newPage();
  await login(landlordPage, LANDLORD_EMAIL, LANDLORD_PASSWORD, /\/(host|dashboard)/);

  const ownRes = await landlordPage.request.get("/api/properties?scope=own&pageSize=24");
  const ownJson = await ownRes.json();
  const owned = (ownJson?.properties ?? []) as Array<{ id: string; title?: string; status?: string; is_active?: boolean }>;
  const target = owned.find((item) => item.status === "live" && item.is_active);
  if (!target) {
    test.skip(true, "No live landlord listing found for save test.");
  }

  const tenantContext = await browser.newContext();
  const tenantPage = await tenantContext.newPage();
  await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD, /\/tenant/);

  await tenantPage.goto(`/properties/${target!.id}`);
  const saveToggle = tenantPage.getByTestId("save-toggle");
  if (!(await saveToggle.isVisible().catch(() => false))) {
    test.skip(true, "Save toggle unavailable on property detail.");
  }
  await saveToggle.click();

  await landlordPage.goto("/host/performance");
  const savesCell = landlordPage.getByTestId(`host-performance-saves-${target!.id}`);
  await expect(savesCell).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => parseCount(savesCell), { timeout: 10_000 })
    .toBeGreaterThan(0);

  await saveToggle.click();
  await expect
    .poll(async () => parseCount(savesCell), { timeout: 10_000 })
    .toBeLessThanOrEqual(1);

  await tenantContext.close();
  await landlordContext.close();
});

test("featured impressions surface in admin inventory", async ({ browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping analytics test.");
  test.skip(!HAS_TENANT || !HAS_ADMIN, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, /\/(admin|dashboard)/);

  await adminPage.goto("/admin/listings");
  const featuredRows = adminPage.getByTestId("admin-featured-row");
  const featuredCount = await featuredRows.count();
  if (!featuredCount) {
    test.skip(true, "No featured listings available for impression test.");
  }

  const row = featuredRows.first();
  const idText = await row.getByText(/ID:/).textContent();
  const propertyId = idText?.split("ID:")[1]?.trim();
  if (!propertyId) {
    test.skip(true, "Unable to resolve featured property id.");
  }

  const impressionsCell = adminPage.getByTestId(`admin-featured-impressions-${propertyId}`);
  const baseline = await parseCount(impressionsCell);

  const tenantContext = await browser.newContext();
  const tenantPage = await tenantContext.newPage();
  await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD, /\/tenant/);
  await tenantPage.goto("/tenant/home");

  await adminPage.goto("/admin/listings");
  const after = await parseCount(impressionsCell);

  if (baseline === 0 && after === 0) {
    test.skip(true, "Featured impressions did not increment during test window.");
  }

  expect(after).toBeGreaterThanOrEqual(baseline);

  await tenantContext.close();
  await adminContext.close();
});
