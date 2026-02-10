import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD || "";

test("agent referrals dashboard smoke", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD (or PLAYWRIGHT_USER_EMAIL/PASSWORD).");

  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|tenant\/home|host|admin)/, { timeout: 20_000 });

  await page.goto("/dashboard/referrals");

  const nonAgentCopy = page.getByText(/available to agent workspaces only/i);
  if (await nonAgentCopy.isVisible({ timeout: 2_000 }).catch(() => false)) {
    test.skip(true, "Provided credentials are not an agent workspace.");
  }

  await expect(page.getByRole("heading", { name: /^Referrals$/i })).toBeVisible();
  await expect(page.getByTestId("referrals-metric-total")).toBeVisible();
  await expect(page.getByTestId("referrals-metric-active")).toBeVisible();
  await expect(page.getByTestId("referrals-metric-rewards")).toBeVisible();
  await expect(page.getByTestId("referrals-tier-badge")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Referral tree/i })).toBeVisible();

  const milestonesSection = page.getByTestId("referrals-milestones-section");
  if (await milestonesSection.isVisible().catch(() => false)) {
    await expect(milestonesSection).toContainText(/Milestones/i);
  }

  const leaderboardSection = page.getByTestId("referrals-leaderboard-section");
  if (await leaderboardSection.isVisible().catch(() => false)) {
    await expect(leaderboardSection).toContainText(/Top referrers/i);
    await expect(leaderboardSection).toContainText(/Your rank|No rank yet/i);
  }

  const shareSection = page.getByTestId("referrals-share-analytics-section");
  if (await shareSection.isVisible().catch(() => false)) {
    await expect(shareSection.getByTestId("referrals-funnel-card")).toBeVisible();
    await expect(shareSection.getByTestId("referrals-top-channel-card")).toBeVisible();
  }

  const copyButton = page.getByRole("button", { name: /^Copy$/i });
  await expect(copyButton).toBeVisible();

  if (await copyButton.isDisabled()) {
    test.skip(true, "Referral link unavailable for this account/environment.");
  }

  await copyButton.click();
  await expect(page.getByText("Link copied")).toBeVisible();
});
