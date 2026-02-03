import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/admin|dashboard|tenant\/home/i, { timeout: 15_000 });
}

test("product updates drawer overlays admin users", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping overlay check.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/users");

  await expect(page.getByTestId("help-open")).toBeVisible();
  await page.getByTestId("help-open").click();
  await expect(page.getByTestId("help-drawer")).toBeVisible();
  await expect(page.getByTestId("help-backdrop")).toBeVisible();

  const firstRow = page.getByTestId("admin-user-row").first();
  const helpBox = await firstRow.boundingBox();
  if (!helpBox) {
    test.skip(true, "No admin user rows available.");
  }
  await page.mouse.click(helpBox!.x + helpBox!.width / 2, helpBox!.y + helpBox!.height / 2);
  await expect(page.getByTestId("admin-user-drawer")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help-drawer")).toHaveCount(0);
  await expect(page.getByTestId("help-open")).toBeFocused();

  await page.getByTestId("updates-bell").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();
  await expect(page.getByTestId("updates-backdrop")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("updates-drawer")).toHaveCount(0);
  await expect(page.getByTestId("updates-bell")).toBeFocused();

  await page.getByTestId("updates-bell").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();

  const box = await firstRow.boundingBox();
  if (!box) {
    test.skip(true, "No admin user rows available.");
  }

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByTestId("admin-user-drawer")).toHaveCount(0);

  await page.getByTestId("updates-bell").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();
  await page.getByTestId("updates-close").click();
  await expect(page.getByTestId("updates-drawer")).toHaveCount(0);

  await firstRow.click();
  await expect(page.getByTestId("admin-user-drawer")).toBeVisible();
});
