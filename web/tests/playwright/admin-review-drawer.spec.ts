import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("admin review desk renders and drawer opens (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping admin review smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/admin/review");
  await expect(page.getByText("Review desk")).toBeVisible();

  await page.getByText("Changes requested").click();
  await expect(page).toHaveURL(/view=changes/);

  const listButtons = page.locator("div.divide-y button");
  const count = await listButtons.count();
  test.skip(count === 0, "No listings to review; skipping drawer interaction.");

  await listButtons.first().click();
  await expect(page).toHaveURL(/id=/);
  await expect(page.getByText("Media")).toBeVisible();
  await expect(page.locator("[data-testid=\"admin-review-media-hero\"]")).toBeVisible();
  await expect(page.getByTestId("admin-listing-performance")).toBeVisible();

  await page.keyboard.press("/");
  await expect(page.locator("input[type=\"search\"]")).toBeFocused();

  const listButtonsForNav = page.locator("div.divide-y [role=\"button\"]");
  const listCount = await listButtonsForNav.count();
  test.skip(listCount < 2, "Not enough listings to test J/K navigation.");
  const initialUrl = page.url();
  await page.keyboard.press("j");
  await expect(page).not.toHaveURL(initialUrl);
});
