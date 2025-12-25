import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const ALLOW_WRITE = (process.env.PLAYWRIGHT_ALLOW_WRITE || "false").toLowerCase() === "true";
const HAS_CREDS = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

test.describe("Admin approvals", () => {
  test("approve pending listing if present", async ({ page }) => {
    test.skip(
      !HAS_CREDS,
      "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run this test."
    );
    test.skip(!ALLOW_WRITE, "PLAYWRIGHT_ALLOW_WRITE must be true to mutate approvals.");

    await page.goto("/auth/login");
    await page.getByPlaceholder("you@email.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/admin");
    await expect(page.getByText(/Control panel/i)).toBeVisible({ timeout: 15_000 });

    const pendingCard = page.locator("div").filter({ hasText: /Pending/i }).first();
    const approveButton = pendingCard.getByRole("button", { name: /Approve/i }).first();

    const hasPending = await approveButton.count();
    test.skip(hasPending === 0, "No pending listings to approve.");

    await approveButton.click();
    await expect(page.getByText(/Approved/i)).toBeVisible({ timeout: 10_000 });
  });
});
