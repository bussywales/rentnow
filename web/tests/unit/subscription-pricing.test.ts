import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSubscriptionPlanQuote,
  resolveYearlySavingsLabel,
} from "../../lib/billing/subscription-pricing";

process.env.STRIPE_PRICE_TENANT_TENANT_PRO_MONTHLY_NGN_LIVE = "price_tenant_ngn_monthly_live";
process.env.STRIPE_PRICE_TENANT_TENANT_PRO_YEARLY_NGN_LIVE = "price_tenant_ngn_yearly_live";
process.env.STRIPE_PRICE_TENANT_MONTHLY_LIVE = "price_tenant_gbp_monthly_live";

void test("subscription pricing resolves exact market-aware Stripe quotes", async () => {
  const quote = await resolveSubscriptionPlanQuote({
    role: "tenant",
    tier: "tenant_pro",
    cadence: "monthly",
    market: { country: "NG", currency: "NGN" },
    stripe: {
      enabled: true,
      mode: "live",
      secretKey: "sk_live_mock",
    },
    paystack: {
      enabled: false,
      mode: "test",
    },
    flutterwave: {
      enabled: false,
      mode: "test",
    },
    stripePriceLoader: async (_secretKey, priceId) => {
      if (priceId === "price_tenant_ngn_monthly_live") {
        return { currency: "NGN", amountMinor: 90000 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "ready");
  assert.equal(quote.provider, "stripe");
  assert.equal(quote.currency, "NGN");
  assert.equal(quote.marketAligned, true);
  assert.equal(quote.fallbackApplied, false);
});

void test("exact local-provider pricing beats Stripe fallback for the wrong currency", async () => {
  const quote = await resolveSubscriptionPlanQuote({
    role: "tenant",
    tier: "tenant_pro",
    cadence: "monthly",
    market: { country: "NG", currency: "NGN" },
    stripe: {
      enabled: true,
      mode: "live",
      secretKey: "sk_live_mock",
    },
    paystack: {
      enabled: true,
      mode: "live",
    },
    flutterwave: {
      enabled: false,
      mode: "test",
    },
    stripePriceLoader: async () => ({ currency: "GBP", amountMinor: 900 }),
  });

  assert.equal(quote.status, "ready");
  assert.equal(quote.provider, "paystack");
  assert.equal(quote.currency, "NGN");
  assert.equal(quote.marketAligned, true);
  assert.equal(quote.fallbackApplied, false);
});

void test("subscription pricing surfaces explicit unavailable state when no safe market price exists", async () => {
  const quote = await resolveSubscriptionPlanQuote({
    role: "tenant",
    tier: "tenant_pro",
    cadence: "monthly",
    market: { country: "CA", currency: "CAD" },
    stripe: {
      enabled: false,
      mode: "live",
      secretKey: null,
    },
    paystack: {
      enabled: true,
      mode: "live",
    },
    flutterwave: {
      enabled: false,
      mode: "test",
    },
  });

  assert.equal(quote.status, "unavailable");
  assert.match(quote.unavailableReason || "", /CAD/);
});

void test("yearly savings are computed only when pricing stays in one currency", () => {
  const label = resolveYearlySavingsLabel({
    monthly: {
      status: "ready",
      provider: "stripe",
      providerMode: "live",
      currency: "GBP",
      amountMinor: 2900,
      displayPrice: "£29.00",
      cadence: "monthly",
      marketCountry: "GB",
      marketCurrency: "GBP",
      marketLabel: "United Kingdom (£)",
      marketAligned: true,
      fallbackApplied: false,
      fallbackMessage: null,
      unavailableReason: null,
      resolutionKey: "a",
      priceId: "b",
    },
    yearly: {
      status: "ready",
      provider: "stripe",
      providerMode: "live",
      currency: "GBP",
      amountMinor: 29000,
      displayPrice: "£290.00",
      cadence: "yearly",
      marketCountry: "GB",
      marketCurrency: "GBP",
      marketLabel: "United Kingdom (£)",
      marketAligned: true,
      fallbackApplied: false,
      fallbackMessage: null,
      unavailableReason: null,
      resolutionKey: "c",
      priceId: "d",
    },
  });

  assert.equal(label, "Save 17%");
});
