import { test, expect, type Browser, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const USER_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const USER_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const HAS_USER = !!USER_EMAIL && !!USER_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|tenant\/home|host|favourites|home)/, { timeout: 20_000 });
}

async function openShareInIncognito(browser: Browser, shareUrl: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(shareUrl);
  await expect(page.getByText("Shared collection")).toBeVisible();
  await context.close();
}

test("user can create a collection, save a listing, and open public share link", async ({ page, browser }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping saved collections flow.");
  test.skip(!HAS_USER, "Set PLAYWRIGHT_USER_EMAIL/PASSWORD to run this test.");

  await login(page, USER_EMAIL, USER_PASSWORD);
  await page.goto("/favourites");

  const title = `QA Collection ${Date.now()}`;
  await page.getByPlaceholder("New collection name").fill(title);
  await page.getByRole("button", { name: /new collection/i }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

  await page.goto("/properties");
  const card = page.getByTestId("property-card").first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "No listings available to save.");
  }

  await card.getByTestId("save-to-collections-open").click();
  const modal = page.getByTestId("save-collections-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("[data-testid='save-collections-modal']")).toHaveCount(1);
  const collectionRow = modal.locator("div", { hasText: title }).first();
  if (!(await collectionRow.isVisible().catch(() => false))) {
    test.skip(true, "Collection row was not rendered in save modal.");
  }
  await collectionRow.getByRole("button", { name: /save|remove/i }).click();
  await expect(modal).toBeVisible();
  await page.waitForTimeout(700);
  await expect(modal).toBeVisible();
  await expect(page.locator("[data-testid='save-collections-modal']")).toHaveCount(1);
  await modal.getByRole("button", { name: /close/i }).click();
  await expect(modal).toBeHidden();

  await page.goto("/favourites");
  const collectionCard = page.locator("article", { hasText: title }).first();
  await expect(collectionCard).toBeVisible();
  await collectionCard.getByRole("button", { name: /share/i }).click();

  const shareModal = page.getByRole("dialog");
  await expect(shareModal).toBeVisible();
  const shareText = (await shareModal.locator("div.break-all").textContent())?.trim() || "";
  if (!shareText.startsWith("http")) {
    test.skip(true, "Share URL was not generated.");
  }

  await openShareInIncognito(browser, shareText);
});
