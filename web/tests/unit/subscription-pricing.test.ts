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
  assert.equal(quote.source, "legacy");
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
  assert.equal(quote.source, "legacy");
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
  assert.equal(quote.source, "legacy");
  assert.match(quote.unavailableReason || "", /CAD/);
});

void test("canonical UK pricing can use a matching temporary legacy Stripe ref without changing canonical truth", async () => {
  process.env.STRIPE_PRICE_TENANT_MONTHLY_LIVE = "price_tenant_gbp_monthly_live";

  const quote = await resolveSubscriptionPlanQuote({
    role: "tenant",
    tier: "tenant_pro",
    cadence: "monthly",
    market: { country: "GB", currency: "GBP" },
    canonicalRows: [
      {
        id: "uk-tenant-monthly",
        product_area: "subscriptions",
        role: "tenant",
        tier: "tenant_pro",
        cadence: "monthly",
        market_country: "GB",
        currency: "GBP",
        amount_minor: 999,
        provider: "stripe",
        provider_price_ref: null,
        active: true,
        fallback_eligible: false,
        effective_at: "2026-03-30T00:00:00Z",
        ends_at: null,
        display_order: 10,
        badge: null,
        operator_notes: null,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
        updated_by: null,
      },
    ],
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
    stripePriceLoader: async (_secretKey, priceId) => {
      if (priceId === "price_tenant_gbp_monthly_live") {
        return { currency: "GBP", amountMinor: 999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "ready");
  assert.equal(quote.source, "canonical");
  assert.equal(quote.provider, "stripe");
  assert.equal(quote.currency, "GBP");
  assert.equal(quote.amountMinor, 999);
  assert.match(quote.resolutionKey || "", /LEGACY_REF/);
  assert.equal(quote.priceId, "price_tenant_gbp_monthly_live");
});

void test("canonical UK pricing prefers a linked provider ref over legacy env refs", async () => {
  process.env.STRIPE_PRICE_LANDLORD_MONTHLY_LIVE = "price_landlord_old_live";

  const quote = await resolveSubscriptionPlanQuote({
    role: "landlord",
    tier: "pro",
    cadence: "monthly",
    market: { country: "GB", currency: "GBP" },
    canonicalRows: [
      {
        id: "uk-landlord-monthly",
        product_area: "subscriptions",
        role: "landlord",
        tier: "pro",
        cadence: "monthly",
        market_country: "GB",
        currency: "GBP",
        amount_minor: 1999,
        provider: "stripe",
        provider_price_ref: "price_landlord_canonical_live",
        active: true,
        fallback_eligible: false,
        effective_at: "2026-03-30T00:00:00Z",
        ends_at: null,
        display_order: 20,
        badge: null,
        operator_notes: null,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
        updated_by: null,
      },
    ],
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
    stripePriceLoader: async (_secretKey, priceId) => {
      if (priceId === "price_landlord_canonical_live") {
        return { currency: "GBP", amountMinor: 1999 };
      }
      if (priceId === "price_landlord_old_live") {
        return { currency: "GBP", amountMinor: 9999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "ready");
  assert.equal(quote.source, "canonical");
  assert.equal(quote.priceId, "price_landlord_canonical_live");
  assert.equal(quote.resolutionKey, "SUBSCRIPTION_PRICE_BOOK:uk-landlord-monthly");
});

void test("canonical UK pricing blocks stale Stripe refs when the linked or legacy price contradicts canonical truth", async () => {
  process.env.STRIPE_PRICE_AGENT_MONTHLY_LIVE = "price_agent_gbp_monthly_live";

  const quote = await resolveSubscriptionPlanQuote({
    role: "agent",
    tier: "pro",
    cadence: "monthly",
    market: { country: "GB", currency: "GBP" },
    canonicalRows: [
      {
        id: "uk-agent-monthly",
        product_area: "subscriptions",
        role: "agent",
        tier: "pro",
        cadence: "monthly",
        market_country: "GB",
        currency: "GBP",
        amount_minor: 3999,
        provider: "stripe",
        provider_price_ref: null,
        active: true,
        fallback_eligible: false,
        effective_at: "2026-03-30T00:00:00Z",
        ends_at: null,
        display_order: 30,
        badge: null,
        operator_notes: null,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
        updated_by: null,
      },
    ],
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
    stripePriceLoader: async (_secretKey, priceId) => {
      if (priceId === "price_agent_gbp_monthly_live") {
        return { currency: "GBP", amountMinor: 4999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "unavailable");
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /does not match canonical UK pricing/);
});

void test("yearly savings are computed only when pricing stays in one currency", () => {
  const label = resolveYearlySavingsLabel({
    monthly: {
      status: "ready",
      source: "legacy",
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
      source: "legacy",
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
