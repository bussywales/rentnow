import { test, expect } from "@playwright/test";

test.describe("admin tabs default to overview", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_URL,
    "PLAYWRIGHT_ADMIN_URL not set; skipping admin tabs smoke"
  );

  test("lands on overview tab and tabs are clickable", async ({ page }) => {
    const base = process.env.PLAYWRIGHT_ADMIN_URL!;
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });

    const overviewTab = page.getByRole("link", { name: /overview/i });
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveAttribute("aria-current", /page|true/);
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();

    const reviewTab = page.getByRole("link", { name: /review queue/i });
    await expect(reviewTab).toBeVisible();

    const listingsTab = page.getByRole("link", { name: /listings/i });
    await listingsTab.click();
    await expect(page).toHaveURL(/tab=listings/);
    await expect(page.getByRole("heading", { name: /all listings/i })).toBeVisible();
    const openButtons = page.getByRole("button", { name: /open/i });
    if (await openButtons.count()) {
      await openButtons.first().click();
      await expect(page).toHaveURL(/id=/);
      await expect(page.getByRole("button", { name: /approve listing/i })).toBeVisible();
    }

    await reviewTab.click();
    await expect(page).toHaveURL(/tab=review/);
    await expect(page.getByRole("heading", { name: /review queue/i })).toBeVisible();
    const statusBadges = page.locator("[data-review-status]");
    if (await statusBadges.count()) {
      const texts = await statusBadges.allTextContents();
      const invalid = texts.find(
        (text) => !/pending|draft|changes/i.test(text.trim().toLowerCase())
      );
      expect(invalid).toBeFalsy();
    }
  });
});
