import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites)/, { timeout: 15_000 });
}

test.describe("Support page visibility", () => {
  test("tenant-facing support shows help content and hides release notes", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByTestId("support-quick-help")).toBeVisible();
    await expect(page.getByTestId("support-common-topics")).toBeVisible();
    await expect(page.getByTestId("support-response-time")).toBeVisible();
    await expect(page.getByTestId("support-admin-status")).toHaveCount(0);
    await expect(page.getByTestId("support-release-notes")).toHaveCount(0);
  });

  test("admin support view includes release notes", async ({ page }) => {
    test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run admin support checks.");
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/support");
    await expect(page.getByTestId("support-admin-status")).toBeVisible();
    await expect(page.getByTestId("support-release-notes")).toBeVisible();
    await expect(page.getByTestId("support-quick-help")).toHaveCount(0);
  });
});
