import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD || "";

async function loginAsAgent(page: Page) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|tenant\/home|host|admin)/, { timeout: 20_000 });
}

test("agent help drawer exposes referral and article links", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD (or PLAYWRIGHT_USER_EMAIL/PASSWORD).");

  await loginAsAgent(page);
  await page.goto("/dashboard/referrals");

  const nonAgentCopy = page.getByText(/available to agent workspaces only/i);
  if (await nonAgentCopy.isVisible({ timeout: 2_000 }).catch(() => false)) {
    test.skip(true, "Provided credentials are not an agent workspace.");
  }

  await expect(page.getByTestId("help-open")).toBeVisible();
  await page.getByTestId("help-open").click();
  await expect(page.getByTestId("help-drawer")).toBeVisible();
  await expect(page.getByTestId("help-drawer")).toContainText(/Referrals/i);
  await expect(page.getByTestId("help-drawer")).toContainText(/Browse all articles/i);
});

test("leaderboard page shows your rank callout", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD (or PLAYWRIGHT_USER_EMAIL/PASSWORD).");

  await loginAsAgent(page);
  await page.goto("/dashboard/referrals/leaderboard");

  if (await page.getByText(/forbidden|auth required/i).first().isVisible().catch(() => false)) {
    test.skip(true, "Current account cannot access leaderboard page.");
  }

  await expect(page.getByRole("heading", { name: /Top referrers/i })).toBeVisible();
  await expect(page.getByTestId("referrals-leaderboard-your-rank")).toContainText(/You're #|You're not ranked yet/i);
});

test("agent help article renders YouTube embed", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set PLAYWRIGHT_AGENT_EMAIL/PASSWORD (or PLAYWRIGHT_USER_EMAIL/PASSWORD).");

  await loginAsAgent(page);
  await page.goto("/help/agents/articles/agent-getting-started");

  await expect(page.getByRole("heading", { name: /Agent getting started/i })).toBeVisible();
  await expect(page.getByTestId("help-youtube-embed")).toBeVisible();
});
