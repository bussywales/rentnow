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
  test("tenant-facing support shows tiles, FAQ, and form", async ({ page }) => {
    await page.route("**/api/support/contact", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, id: "req_123" }),
      });
    });

    await page.goto("/support");
    await expect(page.getByTestId("support-topic-tiles")).toBeVisible();
    await expect(page.getByTestId("support-topic-tile").first()).toBeVisible();

    const faqItem = page.getByTestId("support-faq-item-viewing-request");
    await expect(faqItem).toBeVisible();
    await faqItem.getByText("How do I request a viewing?").click();
    await expect(faqItem.getByText(/request viewing/i)).toBeVisible();

    await page.getByTestId("support-message").fill("Need help with a listing.");
    await page.getByTestId("support-form").getByRole("button", { name: /send to support/i }).click();
    await expect(page.getByText(/We've received your message/i)).toBeVisible();

    await expect(page.getByTestId("support-developer-info")).toHaveCount(0);
  });

  test("admin support view includes release notes", async ({ page }) => {
    test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run admin support checks.");
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/support");
    await expect(page.getByTestId("support-release-notes")).toBeVisible();
    await expect(page.getByTestId("support-developer-info")).toBeVisible();
  });
});
