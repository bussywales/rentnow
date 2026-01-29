import { test, expect } from "@playwright/test";

test.describe("admin UX blueprint", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_URL,
    "PLAYWRIGHT_ADMIN_URL not set; skipping admin UX smoke"
  );

  test("overview, review, listings routes load", async ({ page }) => {
    const base = process.env.PLAYWRIGHT_ADMIN_URL!;

    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByText(/Control panel/i)).toBeVisible();
    await expect(page.getByText(/Pending review/i)).toBeVisible();

    await page.goto(`${base}/admin/review`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /review queue/i })).toBeVisible();
    const reviewRows = page.locator("[data-review-status]");
    if (await reviewRows.count()) {
      await reviewRows.first().click();
      await expect(page).toHaveURL(/\/admin\/review\?id=/);
      await expect(page.getByRole("button", { name: /approve listing/i })).toBeVisible();
      await expect(page.getByText(/review checklist/i)).toBeVisible();
      if ((await reviewRows.count()) > 1) {
        const currentUrl = page.url();
        await page.keyboard.press("j");
        await expect(page).not.toHaveURL(currentUrl);
      }
    }

    await page.goto(`${base}/admin/listings?missingPhotos=true`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /listings registry/i })).toBeVisible();
    await expect(page.getByLabel(/missing photos/i)).toBeChecked();
    const openButtons = page.getByRole("button", { name: /^open$/i });
    if (await openButtons.count()) {
      await openButtons.first().click();
      await expect(page).toHaveURL(/\/admin\/listings\/[0-9a-f-]+/i);
      await expect(page.getByRole("heading", { name: /listing inspector/i })).toBeVisible();
    }
  });
});
