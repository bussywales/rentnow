import { test, expect } from "@playwright/test";

test.describe("admin tabs default to review", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_URL,
    "PLAYWRIGHT_ADMIN_URL not set; skipping admin tabs smoke"
  );

  test("lands on review tab and tabs are clickable", async ({ page }) => {
    const base = process.env.PLAYWRIGHT_ADMIN_URL!;
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });

    const tabs = page.getByRole("link", { name: /review queue/i });
    await expect(tabs).toBeVisible();

    // default should highlight review
    const reviewTab = page.getByRole("link", { name: /review queue/i });
    await expect(reviewTab).toHaveAttribute("aria-current", /page|true/);

    const listingsTab = page.getByRole("link", { name: /listings/i });
    await listingsTab.click();
    await expect(page).toHaveURL(/tab=listings/);

    await reviewTab.click();
    await expect(page).toHaveURL(/(tab=review|\/admin$|\/admin\?)/);
  });
});
