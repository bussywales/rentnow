import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home|host/i, { timeout: 15_000 });
}

test("logged-in user can update profile display name", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping profile test.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  const nameInput = page.getByPlaceholder("Your name");
  const original = await nameInput.inputValue();
  const nextName = original ? `${original} QA` : "QA Profile";

  await nameInput.fill(nextName);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();

  await page.reload();
  await expect(nameInput).toHaveValue(nextName);

  await nameInput.fill(original);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
});

test("logged-out users are redirected to login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/auth\/login\?reason=auth/);
});
