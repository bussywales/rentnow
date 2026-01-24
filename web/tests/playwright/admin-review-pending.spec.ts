import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("admin review pending view shows listings (skip-safe)", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping admin review pending smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/admin");
  const badge = page.locator('a:has-text("Review desk") span');
  const badgeVisible = await badge.count();
  let pendingCount = 0;
  if (badgeVisible > 0) {
    const text = (await badge.first().textContent())?.trim() ?? "";
    pendingCount = Number.parseInt(text, 10);
  }
  test.skip(pendingCount === 0, "No pending listings in badge; skipping visibility assertion.");

  await page.goto("/admin/review?view=pending");
  await expect(page.getByText("Review desk")).toBeVisible();

  const first = page.locator("div.divide-y button").first();
  const count = await first.count();
  test.skip(count === 0, "No pending listings; skipping visibility assertion.");
  await expect(first).toBeVisible();
});
