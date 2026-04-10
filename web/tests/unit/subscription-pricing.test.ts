import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSubscriptionPlanQuote,
  resolveYearlySavingsLabel,
} from "../../lib/billing/subscription-pricing";

process.env.STRIPE_PRICE_TENANT_TENANT_PRO_MONTHLY_NGN_LIVE = "price_tenant_ngn_monthly_live";
process.env.STRIPE_PRICE_TENANT_TENANT_PRO_YEARLY_NGN_LIVE = "price_tenant_ngn_yearly_live";

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
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /Canada \(CA\$\)/);
  assert.match(quote.unavailableReason || "", /subscription pricing is missing/);
});

void test("canonical UK pricing resolves through the linked Stripe recurring price", async () => {
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
        provider_price_ref: "price_1TGlYzPjtZ0fKtkBRTYNfytj",
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
      if (priceId === "price_1TGlYzPjtZ0fKtkBRTYNfytj") {
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
  assert.equal(quote.resolutionKey, "SUBSCRIPTION_PRICE_BOOK:uk-tenant-monthly");
  assert.equal(quote.priceId, "price_1TGlYzPjtZ0fKtkBRTYNfytj");
});

void test("canonical UK pricing uses the provided corrected agent yearly Stripe ref", async () => {
  const quote = await resolveSubscriptionPlanQuote({
    role: "agent",
    tier: "pro",
    cadence: "yearly",
    market: { country: "GB", currency: "GBP" },
    canonicalRows: [
      {
        id: "uk-agent-yearly",
        product_area: "subscriptions",
        role: "agent",
        tier: "pro",
        cadence: "yearly",
        market_country: "GB",
        currency: "GBP",
        amount_minor: 38999,
        provider: "stripe",
        provider_price_ref: "price_1TGlb0PjtZ0fKtkBqgZX4RU1",
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
      if (priceId === "price_1TGlb0PjtZ0fKtkBqgZX4RU1") {
        return { currency: "GBP", amountMinor: 38999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "ready");
  assert.equal(quote.source, "canonical");
  assert.equal(quote.priceId, "price_1TGlb0PjtZ0fKtkBqgZX4RU1");
  assert.equal(quote.amountMinor, 38999);
  assert.equal(quote.resolutionKey, "SUBSCRIPTION_PRICE_BOOK:uk-agent-yearly");
});

void test("canonical UK pricing is unavailable when a canonical row is missing its linked provider ref", async () => {
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
  });

  assert.equal(quote.status, "unavailable");
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /missing a linked Stripe recurring price/);
});

void test("canonical UK pricing blocks linked Stripe refs when they contradict canonical truth", async () => {
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
        provider_price_ref: "price_1TGlacPjtZ0fKtkB598sPlfN",
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
      if (priceId === "price_1TGlacPjtZ0fKtkB598sPlfN") {
        return { currency: "GBP", amountMinor: 4999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "unavailable");
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /does not match canonical United Kingdom/);
});

void test("canonical Canada pricing is unavailable until a local CAD Stripe price is linked", async () => {
  const quote = await resolveSubscriptionPlanQuote({
    role: "agent",
    tier: "pro",
    cadence: "monthly",
    market: { country: "CA", currency: "CAD" },
    canonicalRows: [
      {
        id: "ca-agent-monthly",
        product_area: "subscriptions",
        role: "agent",
        tier: "pro",
        cadence: "monthly",
        market_country: "CA",
        currency: "GBP",
        amount_minor: 4999,
        provider: "stripe",
        provider_price_ref: "price_1SkqghIrMBE5QKLYnMjdVunO",
        active: true,
        fallback_eligible: false,
        effective_at: "2026-04-06T17:30:00Z",
        ends_at: null,
        display_order: 30,
        badge: "Interim",
        operator_notes: null,
        created_at: "2026-04-06T17:30:00Z",
        updated_at: "2026-04-06T17:30:00Z",
        updated_by: null,
      },
    ],
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
      if (priceId === "price_1SkqghIrMBE5QKLYnMjdVunO") {
        return { currency: "GBP", amountMinor: 4999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "unavailable");
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /Local CAD Stripe pricing is still being configured/);
});

void test("canonical Canada pricing does not fall back to legacy GBP Stripe env prices when canonical rows are missing", async () => {
  process.env.STRIPE_PRICE_AGENT_MONTHLY = "price_agent_monthly_gbp";

  const quote = await resolveSubscriptionPlanQuote({
    role: "agent",
    tier: "pro",
    cadence: "monthly",
    market: { country: "CA", currency: "CAD" },
    canonicalRows: [],
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
      if (priceId === "price_agent_monthly_gbp") {
        return { currency: "GBP", amountMinor: 4999 };
      }
      return null;
    },
  });

  assert.equal(quote.status, "unavailable");
  assert.equal(quote.source, "canonical");
  assert.match(quote.unavailableReason || "", /Canonical Canada \(CA\$\) subscription pricing is missing/);
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
