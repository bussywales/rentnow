import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

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

test("admin can configure jurisdiction rate mode with percent/amount auto-calc and source toggles", async ({
  page,
}) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin creds missing.");

  const countryCode = "RW";

  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/settings/referrals");

  await page.request.patch("/api/admin/app-settings", {
    data: {
      key: "payg_listing_fee_amount",
      value: { value: 2000 },
    },
  });
  await page.reload();

  await page.locator("#jurisdiction-create-country-select").click();
  await page.getByPlaceholder(/search countries/i).fill("Rwanda");
  await page.getByRole("option", { name: /Rwanda \(RW\)/i }).first().click();

  await page.getByTestId("jurisdiction-create-rate-mode-percent").check();
  await page.getByTestId("jurisdiction-create-rate-percent").fill("2.5");
  await expect(page.getByTestId("jurisdiction-create-rate-amount")).toHaveValue(/50/);

  await page.getByTestId("jurisdiction-create-rate-mode-fixed").check();
  await page.getByTestId("jurisdiction-create-rate-amount").fill("50");
  await expect(page.getByTestId("jurisdiction-create-rate-percent")).toHaveValue(/2\.5/);

  const subscriptionToggle = page.getByTestId(
    "jurisdiction-create-source-subscription_paid"
  );
  await expect(subscriptionToggle).not.toBeChecked();
  await subscriptionToggle.check();
  await expect(subscriptionToggle).toBeChecked();

  await page.getByTestId("jurisdiction-create-save").click();
  await expect(page.getByText(new RegExp(`Saved\\s+${countryCode}\\.`))).toBeVisible();

  await page.reload();

  const policyCard = page.getByTestId(`jurisdiction-policy-card-${countryCode}`);
  await expect(policyCard).toBeVisible();
  await expect(policyCard.getByTestId(`jurisdiction-${countryCode}-source-subscription_paid`)).toBeChecked();
  await expect(policyCard.getByTestId(`jurisdiction-${countryCode}-rate-amount`)).toHaveValue(/50/);
  await expect(policyCard.getByTestId(`jurisdiction-${countryCode}-rate-percent`)).toHaveValue(/2\.5/);
});
