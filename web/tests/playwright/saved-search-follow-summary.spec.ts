import { test, expect } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const EMAIL = process.env.E2E_EMAIL || "";
const PASSWORD = process.env.E2E_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test("follow search appears in saved searches and summary", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved search flow.");
  test.skip(!HAS_CREDS, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|tenant|home|host)/, { timeout: 15_000 });
  const landingPath = new URL(page.url()).pathname;

  const name = `Follow Lagos ${Date.now()}`;
  await page.goto("/properties?city=Lagos&bedrooms=2");
  await page.getByRole("button", { name: /follow this search/i }).click();
  await page.getByLabel(/search name/i).fill(name);
  await page.getByRole("button", { name: /follow search/i }).click();

  await page.goto("/dashboard/saved-searches");
  await expect(page.getByText(name)).toBeVisible();

  const summaryRes = await page.request.get("/api/saved-searches/summary");
  expect(summaryRes.ok()).toBeTruthy();
  const summary = await summaryRes.json();
  expect(typeof summary?.totalNewMatches).toBe("number");
  expect(Array.isArray(summary?.searches)).toBeTruthy();
  expect(summary.searches.some((item: { name?: string }) => item?.name === name)).toBeTruthy();

  if (landingPath.startsWith("/tenant")) {
    await page.goto("/tenant/home");
    await expect(page.getByText(/new matches for your saved searches/i)).toBeVisible();
  } else {
    await page.goto("/home");
    await expect(page.getByText(/demand alerts/i)).toBeVisible();
  }
});
