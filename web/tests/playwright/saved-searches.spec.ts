import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";

const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites|tenant)/, { timeout: 15_000 });
}

test("tenant can save search and others cannot access it", async ({ browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved search flow.");
  test.skip(
    !(HAS_TENANT && HAS_LANDLORD),
    "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test."
  );

  const tenantContext = await browser.newContext();
  const tenantPage = await tenantContext.newPage();
  await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD);

  await tenantPage.goto("/properties?city=Lagos&bedrooms=2");
  await tenantPage.getByRole("button", { name: /save this search/i }).click();
  await tenantPage.getByLabel("Search name").fill(`Lagos 2-bed ${Date.now()}`);
  await tenantPage.getByRole("button", { name: /save search/i }).click();

  await tenantPage.goto("/dashboard/saved-searches");
  await expect(tenantPage.getByText(/Lagos 2-bed/i)).toBeVisible();

  const listRes = await tenantPage.request.get("/api/saved-searches");
  expect(listRes.ok()).toBeTruthy();
  const listJson = await listRes.json();
  const savedId = listJson?.searches?.[0]?.id as string | undefined;
  expect(savedId).toBeTruthy();

  await tenantContext.close();

  const landlordContext = await browser.newContext();
  const landlordPage = await landlordContext.newPage();
  await login(landlordPage, LANDLORD_EMAIL, LANDLORD_PASSWORD);
  const hijackRes = await landlordPage.request.patch(
    `/api/saved-searches/${savedId}`,
    { data: { name: "Hack" } }
  );
  expect([403, 404]).toContain(hijackRes.status());
  await landlordContext.close();
});
