import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("admin review mobile list -> detail (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping admin review mobile smoke.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/admin/review");
  const rows = page.getByTestId("admin-review-queue-row");
  const count = await rows.count();
  test.skip(count === 0, "No review queue rows; skipping mobile detail.");

  await rows.first().click();
  await expect(page).toHaveURL(/\/admin\/review\/.+/);
  await expect(page.getByText("Media")).toBeVisible();
  await expect(page.getByText("Key facts")).toBeVisible();
  await expect(page.locator("[data-testid=\"admin-review-media-hero\"]")).toBeVisible();
});

test("admin review mobile deep link by listing id (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping admin review deep link.");
  const listingId = process.env.E2E_REVIEW_LISTING_ID;
  test.skip(!listingId, "E2E_REVIEW_LISTING_ID not set; skipping deep link check.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto(`/admin/review/${listingId}`);
  await expect(page.getByText("Media")).toBeVisible();
  await expect(page.getByText("Key facts")).toBeVisible();
});
