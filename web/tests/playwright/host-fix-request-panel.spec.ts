import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const listingId = process.env.E2E_LISTING_CHANGES_ID;

test("host fix request panel renders and links to photos (skip-safe)", async ({ page }) => {
  test.skip(!email || !password || !listingId, "Missing creds or listing id; skipping fix request panel smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto(`/dashboard/properties/${listingId}`);
  const panel = page.getByText("Fix requested");
  await expect(panel).toBeVisible();

  const goToPhotos = page.getByRole("button", { name: /go to photos/i });
  await goToPhotos.click();
  await expect(page).toHaveURL(/step=photos/);
});
