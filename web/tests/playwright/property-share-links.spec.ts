import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const PROPERTY_ID = process.env.PLAYWRIGHT_SHARE_PROPERTY_ID || "";

const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/properties|\/favourites/, { timeout: 15_000 });
}

test("property share link redirects through auth (skip-safe)", async ({ browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping share link flow.");
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run share link flow.");
  test.skip(!PROPERTY_ID, "Set PLAYWRIGHT_SHARE_PROPERTY_ID to run share link flow.");

  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);

  const apiRes = await page.request.post("/api/share/property", {
    data: { propertyId: PROPERTY_ID },
  });
  expect(apiRes.ok()).toBeTruthy();
  const payload = await apiRes.json();
  const link = payload.link as string;
  expect(link).toContain("/share/property/");

  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(link);
  await expect(anonPage).toHaveURL(/\/auth\/login\?[^#]*redirect=/);

  await anonPage.getByPlaceholder("you@email.com").fill(LANDLORD_EMAIL);
  await anonPage.getByPlaceholder("Password").fill(LANDLORD_PASSWORD);
  await anonPage.getByRole("button", { name: /log in/i }).click();
  await anonPage.waitForURL(new RegExp(`/properties/${PROPERTY_ID}`));
});

