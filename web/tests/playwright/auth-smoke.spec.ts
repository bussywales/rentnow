import { test, expect } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const EMAIL = process.env.E2E_EMAIL || "";
const PASSWORD = process.env.E2E_PASSWORD || "";
const HAS_CREDS = !!EMAIL && !!PASSWORD;

test.describe("Auth smoke", () => {
  test("session persists across refresh and new tab", async ({ page, context }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping auth smoke.");
    test.skip(!HAS_CREDS, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.waitForURL(/\/(dashboard|tenant|host)/, { timeout: 15_000 });

    const landingPath = new URL(page.url()).pathname;
    let protectedPath = "/dashboard";
    if (landingPath.startsWith("/tenant")) {
      protectedPath = "/tenant";
    } else if (landingPath.startsWith("/host")) {
      protectedPath = "/host";
    }

    const healthResponse = await page.request.get("/api/auth/health");
    expect(healthResponse.ok()).toBeTruthy();
    const healthJson = await healthResponse.json();
    expect(healthJson.ok).toBe(true);

    await page.reload();
    await expect(page).not.toHaveURL(/\/auth\/login\?reason=auth/);

    await page.goto(protectedPath);
    await expect(page).not.toHaveURL(/\/auth\/login\?reason=auth/);

    const newPage = await context.newPage();
    await newPage.goto(protectedPath);
    await expect(newPage).not.toHaveURL(/\/auth\/login\?reason=auth/);
  });
});
