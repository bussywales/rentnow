import { test, expect } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const HAS_TENANT = !!TENANT_EMAIL;

test("auth reset applies resend cooldown (mobile)", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping auth cooldown check.");
  test.skip(!HAS_TENANT, "Set PLAYWRIGHT_USER_EMAIL to run this test.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/reset");

  await page.getByPlaceholder("you@email.com").fill(TENANT_EMAIL);
  const sendButton = page.getByTestId("auth-reset-submit");
  await sendButton.click();

  await expect(sendButton).toBeDisabled();
  await expect(page.getByTestId("auth-resend-countdown")).toBeVisible();

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.includes("ph:auth:resend:reset:")
    );
    if (key) {
      localStorage.setItem(key, String(Date.now() + 1000));
    }
  });

  await page.waitForTimeout(1200);
  await expect(sendButton).toBeEnabled();
});
