import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("video upload button gating for unsaved vs saved listing (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping video upload gating smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  // Unsaved listing, jump to Photos step to inspect button
  await page.goto("/dashboard/properties/new?step=photos");
  const uploadButton = page.getByRole("button", { name: /upload video/i });
  await expect(uploadButton).toBeDisabled();

  // Create a minimal listing to enable upload
  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Video gating smoke");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/details/);
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  await expect(page.getByRole("button", { name: /upload video/i })).not.toBeDisabled();
});
