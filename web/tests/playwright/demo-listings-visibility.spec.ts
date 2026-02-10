import { expect, test } from "@playwright/test";

test("public browse hides demo badges in production", async ({ page }) => {
  test.skip(
    process.env.NODE_ENV !== "production",
    "Demo listings are intentionally visible in non-production environments."
  );

  await page.goto("/properties");
  await expect(page.locator(".property-demo-badge")).toHaveCount(0);
});
