import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const TENANT_EMAIL = process.env.PLAYWRIGHT_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_TENANT_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;
const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/tenant\/home|dashboard|admin|properties|favourites/i, { timeout: 15_000 });
}

test("product updates bell reflects published updates", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping product updates test.");
  test.skip(!HAS_ADMIN || !HAS_TENANT, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD and PLAYWRIGHT_TENANT_EMAIL/PASSWORD.");

  const updateTitle = `Update ${Date.now()}`;
  const updateSummary = "We improved the booking flow so tenants can confirm viewings faster.";

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/product-updates");

  await page.getByRole("button", { name: /new update/i }).click();
  await page.getByTestId("admin-update-title").fill(updateTitle);
  await page.getByTestId("admin-update-summary").fill(updateSummary);
  await page.getByTestId("admin-update-audience").selectOption("tenant");

  const fixturePath = path.join(__dirname, "..", "fixtures", "small-10x10.png");
  await page.getByTestId("admin-update-image-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("admin-update-image-preview")).toBeVisible();

  await page.getByTestId("admin-update-create").click();

  const row = page.getByTestId("admin-update-row").filter({ hasText: updateTitle }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /publish/i }).click();
  await expect(row.getByText(/Published/i)).toBeVisible();

  await expect(page.getByTestId("updates-bell")).toBeVisible();
  await page.getByTestId("updates-bell").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();
  await expect(page.getByText(updateTitle)).toBeVisible();
  await expect(page.getByTestId("updates-view-all")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("updates-view-admin").click();
  await expect(page.getByTestId("updates-view-admin")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(updateTitle)).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.reload();
  await page.getByTestId("updates-bell").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();
  await expect(page.getByTestId("updates-view-admin")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(updateTitle)).toHaveCount(0);
  await page.getByTestId("updates-view-all").click();
  await expect(page.getByText(updateTitle)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL(/auth\/login|auth\/register|auth\/required|properties|tenant/i, { timeout: 15_000 });

  await login(page, TENANT_EMAIL, TENANT_PASSWORD);
  await page.goto("/tenant/home");
  await expect(page.getByTestId("updates-bell")).toBeVisible();
  await expect(page.getByTestId("updates-badge")).toBeVisible();

  await expect(page.getByTestId("updates-onboarding")).toBeVisible();
  await page.getByTestId("updates-onboarding-open").click();
  await expect(page.getByTestId("updates-drawer")).toBeVisible();
  await expect(page.getByTestId("updates-since-last-visit")).toContainText(
    "New since your last visit"
  );
  await expect(page.getByText(updateTitle)).toBeVisible();

  const updateItem = page
    .locator("[data-testid^='updates-item-']")
    .filter({ hasText: updateTitle })
    .first();
  await expect(updateItem).toBeVisible();
  await expect(updateItem.getByTestId("update-unread-dot")).toHaveAttribute(
    "data-state",
    "unread"
  );

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await expect(page.getByTestId(`updates-month-${monthKey}`)).toBeVisible();

  await updateItem.click();
  await expect(updateItem.getByTestId("update-unread-dot")).toHaveAttribute(
    "data-state",
    "read"
  );
  await expect(updateItem.getByTestId("update-read")).toHaveCount(1);

  const markAll = page.getByTestId("updates-mark-all");
  if (await markAll.isEnabled()) {
    await markAll.click();
  }
  await expect(page.getByTestId("updates-badge")).toHaveCount(0);
});
