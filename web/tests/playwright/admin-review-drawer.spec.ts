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

  const listButtons = page.locator("div.divide-y button").first();
  const count = await listButtons.count();
  test.skip(count === 0, "No listings to review; skipping drawer interaction.");

  await listButtons.click();
  await expect(page).toHaveURL(/id=/);
  await expect(page.getByText("Overview")).toBeVisible();

  const approveButton = page.getByRole("button", { name: /approve listing/i });
  test.skip(!(await approveButton.isVisible()), "No actionable listing; skipping approve flow.");

  await approveButton.click();
  await expect(page).toHaveURL(/id=/);
  await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 2000 });
});
