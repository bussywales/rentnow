import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("admin request changes rubric shows reasons and preview (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping admin review rubric smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/admin/review");
  await expect(page.getByText("Review desk")).toBeVisible();

  const firstListing = page.locator("div.divide-y button").first();
  const count = await firstListing.count();
  test.skip(count === 0, "No listings to review; skipping rubric smoke.");

  await firstListing.click();
  await expect(page).toHaveURL(/id=/);

  const reasonCheckbox = page.getByLabel(/Location is unclear/i);
  await reasonCheckbox.check();
  await expect(page.getByText(/Preview/)).toBeVisible();
  await expect(page.getByText(/Location is unclear/i)).toBeVisible();
});
