import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15_000 });
}

test("admin can feature listings with scheduling", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping featured control flow.");
  test.skip(!HAS_ADMIN, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test.");

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto("/admin/listings");
  const rows = page.getByTestId("admin-listings-row");
  const count = await rows.count();
  if (!count) {
    test.skip(true, "No listings available to feature.");
  }

  let targetIndex = -1;
  let listingTitle = "";
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const statusText = await row.locator("td").nth(3).innerText();
    const activeText = await row.locator("td").nth(5).innerText();
    if (statusText.toLowerCase().includes("live") && activeText.toLowerCase().includes("yes")) {
      listingTitle = await row.locator("button").first().innerText();
      targetIndex = i;
      break;
    }
  }

  if (targetIndex < 0) {
    test.skip(true, "No live listings available to feature.");
  }

  const targetRow = rows.nth(targetIndex);
  await targetRow.click();
  await page.waitForURL(/\/admin\/listings\//, { timeout: 15_000 });
  const listingUrl = page.url();

  const toggle = page.getByTestId("admin-featured-toggle");
  await expect(toggle).toBeVisible();
  if (!(await toggle.isChecked())) {
    await toggle.check();
  }

  await page.getByTestId("admin-featured-rank").fill("1");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page.getByTestId("admin-featured-until").fill(formatDateTimeLocal(tomorrow));
  await page.getByTestId("admin-featured-save").click();
  await expect(page.getByText(/Featured settings saved/i)).toBeVisible();

  await page.goto("/properties?featured=true");
  const featuredCard = page
    .getByTestId("property-card")
    .filter({ hasText: listingTitle })
    .first();
  await expect(featuredCard).toBeVisible({ timeout: 15_000 });

  await page.goto(listingUrl);
  await expect(page.getByTestId("admin-featured-panel")).toBeVisible();
  if (await toggle.isChecked()) {
    await toggle.uncheck();
  }
  await page.getByTestId("admin-featured-save").click();
  await expect(page.getByText(/Featured settings saved/i)).toBeVisible();

  await page.goto("/properties?featured=true");
  const filtered = page.getByTestId("property-card").filter({ hasText: listingTitle });
  await expect(filtered).toHaveCount(0);
});
