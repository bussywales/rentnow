import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL;
const AGENT_PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");

  const emailLabel = page.getByLabel(/email/i);
  if (await emailLabel.isVisible().catch(() => false)) {
    await emailLabel.fill(email);
  } else {
    await page.getByPlaceholder("you@email.com").fill(email);
  }

  const passwordLabel = page.getByLabel(/password/i);
  if (await passwordLabel.isVisible().catch(() => false)) {
    await passwordLabel.fill(password);
  } else {
    await page.getByPlaceholder("Password").fill(password);
  }

  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard|admin|tenant|host/, { timeout: 20_000 });
}

test("agent sees cashout disabled message in default country (skip-safe)", async ({ page }) => {
  test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Agent creds missing.");

  await login(page, AGENT_EMAIL!, AGENT_PASSWORD!);
  await page.goto("/dashboard/referrals");

  const nonAgentCopy = page.getByText(/available to agent workspaces only/i);
  if (await nonAgentCopy.isVisible({ timeout: 2_000 }).catch(() => false)) {
    test.skip(true, "Credentials are not an agent workspace.");
  }

  const disabled = page.getByTestId("referrals-cashout-disabled");
  const cta = page.getByRole("button", { name: /request cashout/i });

  if (await cta.isVisible().catch(() => false)) {
    test.skip(true, "Cashout is already enabled in this environment.");
  }

  await expect(disabled).toBeVisible();
});

test("admin enables country policy and agent sees cashout CTA", async ({ browser }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD || !AGENT_EMAIL || !AGENT_PASSWORD,
    "Admin + agent creds required."
  );

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await adminPage.goto("/admin/settings/referrals");

  await adminPage.evaluate(async () => {
    await fetch("/api/admin/referrals/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country_code: "NG",
        payouts_enabled: true,
        conversion_enabled: true,
        credit_to_cash_rate: 50,
        currency: "NGN",
        min_cashout_credits: 1,
        monthly_cashout_cap_amount: 100000,
        requires_manual_approval: true,
      }),
    });
  });

  await adminContext.close();

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await login(agentPage, AGENT_EMAIL!, AGENT_PASSWORD!);
  await agentPage.goto("/dashboard/referrals");

  const nonAgentCopy = agentPage.getByText(/available to agent workspaces only/i);
  if (await nonAgentCopy.isVisible({ timeout: 2_000 }).catch(() => false)) {
    test.skip(true, "Credentials are not an agent workspace.");
  }

  await expect(agentPage.getByRole("button", { name: /request cashout/i })).toBeVisible();
  await agentContext.close();
});

test("agent cashout request appears in admin payout queue", async ({ browser }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD || !AGENT_EMAIL || !AGENT_PASSWORD,
    "Admin + agent creds required."
  );

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await adminPage.goto("/admin/referrals/payouts");
  await expect(adminPage.getByRole("heading", { name: /referral cashout payouts/i })).toBeVisible();
  const beforeCount = await adminPage.getByTestId("admin-referrals-cashout-row").count();

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await login(agentPage, AGENT_EMAIL!, AGENT_PASSWORD!);
  await agentPage.goto("/dashboard/referrals");

  const cta = agentPage.getByRole("button", { name: /request cashout/i });
  if (!(await cta.isVisible().catch(() => false))) {
    test.skip(true, "Cashout CTA not visible for this agent.");
  }

  await agentPage.getByLabel("Cashout credits").fill("1");
  await cta.click();

  const error = agentPage.getByText(/insufficient credits|cashout disabled|below min cashout|monthly cap exceeded/i);
  if (await error.isVisible({ timeout: 3_000 }).catch(() => false)) {
    test.skip(true, "Agent has no cashout-eligible credits for request flow.");
  }

  await expect(agentPage.getByText(/cashout request submitted/i)).toBeVisible();
  await agentContext.close();

  await adminPage.reload();
  await expect(adminPage.getByRole("heading", { name: /referral cashout payouts/i })).toBeVisible();
  const afterCount = await adminPage.getByTestId("admin-referrals-cashout-row").count();
  expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
  await adminContext.close();
});
