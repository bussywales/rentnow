import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("billing page resolves market-aware subscription pricing on the server", () => {
  const source = read("app/dashboard/billing/page.tsx");

  assert.match(source, /loadSubscriptionPriceBookRows/);
  assert.match(source, /resolveMarketFromRequest/);
  assert.match(source, /resolveSubscriptionPlanQuote/);
  assert.match(source, /pricingByPlanKey/);
  assert.match(source, /marketCurrency=\{market\.currency\}/);
});

void test("plans grid no longer hardcodes GBP subscription labels", () => {
  const gridSource = read("components/billing/PlansGrid.tsx");
  const cardSource = read("components/billing/PlanCard.tsx");

  assert.doesNotMatch(gridSource, /£29 \/ month|£49 \/ month|£9 \/ month|£290 \/ year|£490 \/ year|£90 \/ year/);
  assert.doesNotMatch(cardSource, /£0/);
  assert.match(gridSource, /pricingByPlanKey/);
  assert.match(cardSource, /pricing\?\.provider/);
});

void test("stripe checkout route resolves market-aware subscription pricing before session creation", () => {
  const source = read("app/api/billing/stripe/checkout/route.ts");

  assert.match(source, /loadSubscriptionPriceBookRows/);
  assert.match(source, /resolveMarketFromRequest/);
  assert.match(source, /resolveSubscriptionPlanQuote/);
  assert.match(source, /subscription_market_currency/);
});

void test("billing page surfaces subscription lifecycle state and Stripe portal return messaging", () => {
  const source = read("app/dashboard/billing/page.tsx");
  const tenantSource = read("app/tenant/billing/page.tsx");
  const gridSource = read("components/billing/PlansGrid.tsx");
  const cardSource = read("components/billing/PlanCard.tsx");

  assert.match(source, /resolveSubscriptionLifecycleState/);
  assert.match(source, /Returned from Stripe billing portal\./);
  assert.match(source, /Lifecycle/);
  assert.match(source, /Cancellation requested/);
  assert.match(source, /parseParam\(resolvedSearchParams, "stripe"\) === "portal-return"/);
  assert.match(tenantSource, /<BillingPage searchParams=\{searchParams\} \/>/);
  assert.match(gridSource, /Lifecycle: \{lifecycleLabel\}/);
  assert.match(cardSource, /Manage subscription/);
});

void test("billing page surfaces the active market payment provider mode instead of always advertising Stripe", () => {
  const source = read("app/dashboard/billing/page.tsx");
  const badgeSource = read("components/billing/PaymentModeBadge.tsx");

  assert.match(source, /resolveBillingModePresentation/);
  assert.match(source, /providerLabel: "Paystack"/);
  assert.match(source, /providerLabel: "Stripe"/);
  assert.match(source, /providerLabel=\{billingModePresentation\.providerLabel\}/);
  assert.match(source, /Paystack test mode enabled for this market/);
  assert.match(badgeSource, /providerLabel\?: string/);
  assert.match(badgeSource, /providerLabel = "Payments"/);
});

void test("billing UI keeps local-currency pending copy explicit when a market is intentionally gated", () => {
  const gridSource = read("components/billing/PlansGrid.tsx");
  const cardSource = read("components/billing/PlanCard.tsx");
  const pricingSource = read("lib/billing/subscription-pricing.ts");

  assert.match(gridSource, /Local-currency subscription checkout is not available in this market yet\./);
  assert.match(cardSource, /Local pricing pending/);
  assert.match(pricingSource, /pricing\.provider === "paystack"/);
  assert.match(pricingSource, /pricing\.provider === "flutterwave"/);
  assert.match(pricingSource, /Stripe billing management does not apply to this plan path/);
});
