import { test, expect } from "@playwright/test";

const EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.PLAYWRIGHT_USER_EMAIL || "";
const PASSWORD = process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.PLAYWRIGHT_USER_PASSWORD || "";

test("agent can create tracking link and open campaign detail", async ({ page, context }) => {
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

  const section = page.getByTestId("referrals-share-analytics-section");
  await expect(section).toBeVisible();

  await section.getByPlaceholder(/WhatsApp Abuja February/i).fill(`PW Campaign ${Date.now()}`);
  await section.getByTestId("referrals-create-tracking-link").click();

  const latestLinkInput = section.getByTestId("referrals-latest-share-link");
  await expect(latestLinkInput).toBeVisible();
  const latestLink = await latestLinkInput.inputValue();
  expect(latestLink).toContain("/r/");

  await page.goto("/dashboard/referrals/campaigns");
  await expect(page.getByRole("heading", { name: /Referral campaigns/i })).toBeVisible();
  const openLink = page.getByRole("link", { name: /^Open$/i }).first();
  await expect(openLink).toBeVisible();
  await openLink.click();
  await expect(page.getByTestId("referral-campaign-detail-header")).toBeVisible();

  const currentOrigin = new URL(page.url()).origin;
  const parsed = new URL(latestLink);
  const localShareLink = `${currentOrigin}${parsed.pathname}${parsed.search}`;
  await page.goto(localShareLink);

  const cookies = await context.cookies();
  const cookieNames = new Set(cookies.map((cookie) => cookie.name));
  expect(cookieNames.has("ph_referral_code")).toBeTruthy();
  expect(cookieNames.has("ph_anon_id")).toBeTruthy();
});
