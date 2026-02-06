import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || "";
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || "";
const HAS_AGENT = !!AGENT_EMAIL && !!AGENT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home|host|profile/i, { timeout: 15_000 });
}

test.describe("client pages shortcut", () => {
  test("agent sees shortcut on profile and can navigate", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping.");
    test.skip(!HAS_AGENT, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD to run this test.");

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/profile");

    const button = page.getByTestId("client-pages-shortcut");
    await expect(button).toBeVisible();
    await button.click();

    await expect(page).toHaveURL(/\/profile\/clients/);
    await expect(page.getByRole("heading", { name: /client pages/i })).toBeVisible();
  });
});
