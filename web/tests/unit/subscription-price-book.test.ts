import test from "node:test";
import assert from "node:assert/strict";

import { buildSubscriptionPriceMatrixEntries } from "@/lib/billing/subscription-price-book";

void test("subscription price matrix flags UK canonical checkout mismatches without hiding canonical truth", () => {
  const [entry] = buildSubscriptionPriceMatrixEntries({
    canonicalRows: [
      {
        id: "1",
        product_area: "subscriptions",
        role: "agent",
        tier: "pro",
        cadence: "yearly",
        market_country: "GB",
        currency: "GBP",
        amount_minor: 38999,
        provider: "stripe",
        provider_price_ref: null,
        active: true,
        fallback_eligible: false,
        effective_at: "2026-03-30T00:00:00Z",
        ends_at: null,
        display_order: 31,
        badge: null,
        operator_notes: null,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
        updated_by: null,
      },
    ],
    runtimeQuotes: [
      {
        marketCountry: "GB",
        marketCurrency: "GBP",
        role: "agent",
        tier: "pro",
        cadence: "yearly",
        quote: {
          status: "ready",
          source: "legacy",
          provider: "stripe",
          providerMode: "live",
          currency: "GBP",
          amountMinor: 49900,
          displayPrice: "£499.00",
          cadence: "yearly",
          marketCountry: "GB",
          marketCurrency: "GBP",
          marketLabel: "United Kingdom (£)",
          marketAligned: true,
          fallbackApplied: false,
          fallbackMessage: null,
          unavailableReason: null,
          resolutionKey: "STRIPE_PRICE_AGENT_YEARLY",
          priceId: "price_agent_yearly_live",
        },
      },
    ],
  });

  assert.equal(entry.marketGap, false);
  assert.equal(entry.checkoutMatchesCanonical, false);
  assert.equal(entry.missingProviderRef, true);
  assert.match(entry.diagnostics.join(" | "), /Checkout mismatch/);
  assert.match(entry.diagnostics.join(" | "), /Missing provider ref/);
});

void test("subscription price matrix surfaces market gaps and runtime fallback separately", () => {
  const [entry] = buildSubscriptionPriceMatrixEntries({
    canonicalRows: [],
    runtimeQuotes: [
      {
        marketCountry: "CA",
        marketCurrency: "CAD",
        role: "tenant",
        tier: "tenant_pro",
        cadence: "monthly",
        quote: {
          status: "ready",
          source: "legacy",
          provider: "stripe",
          providerMode: "live",
          currency: "GBP",
          amountMinor: 999,
          displayPrice: "£9.99",
          cadence: "monthly",
          marketCountry: "CA",
          marketCurrency: "CAD",
          marketLabel: "Canada (CA$)",
          marketAligned: false,
          fallbackApplied: true,
          fallbackMessage: "No CAD Stripe price is configured yet. Checkout will charge in GBP.",
          unavailableReason: null,
          resolutionKey: "STRIPE_PRICE_TENANT_MONTHLY",
          priceId: "price_tenant_monthly_live",
        },
      },
    ],
  });

  assert.equal(entry.marketGap, true);
  assert.equal(entry.runtimeFallback, true);
  assert.equal(entry.checkoutMatchesCanonical, false);
  assert.match(entry.diagnostics.join(" | "), /Market gap/);
  assert.match(entry.diagnostics.join(" | "), /Runtime fallback/);
});

void test("subscription price matrix marks canonical cross-currency markets without calling them runtime fallback", () => {
  const [entry] = buildSubscriptionPriceMatrixEntries({
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
    runtimeQuotes: [
      {
        marketCountry: "CA",
        marketCurrency: "CAD",
        role: "agent",
        tier: "pro",
        cadence: "monthly",
        quote: {
          status: "ready",
          source: "canonical",
          provider: "stripe",
          providerMode: "live",
          currency: "GBP",
          amountMinor: 4999,
          displayPrice: "£49.99",
          cadence: "monthly",
          marketCountry: "CA",
          marketCurrency: "CAD",
          marketLabel: "Canada (CA$)",
          marketAligned: false,
          fallbackApplied: false,
          fallbackMessage: null,
          unavailableReason: null,
          resolutionKey: "SUBSCRIPTION_PRICE_BOOK:ca-agent-monthly",
          priceId: "price_1SkqghIrMBE5QKLYnMjdVunO",
        },
      },
    ],
  });

  assert.equal(entry.marketGap, false);
  assert.equal(entry.runtimeFallback, false);
  assert.equal(entry.checkoutMatchesCanonical, true);
  assert.match(entry.diagnostics.join(" | "), /Canonical runtime/);
  assert.match(entry.diagnostics.join(" | "), /Cross-currency canonical/);
  assert.doesNotMatch(entry.diagnostics.join(" | "), /Runtime fallback/);
});

void test("subscription price matrix marks aligned canonical rows cleanly", () => {
  const [entry] = buildSubscriptionPriceMatrixEntries({
    canonicalRows: [
      {
        id: "2",
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
    runtimeQuotes: [
      {
        marketCountry: "GB",
        marketCurrency: "GBP",
        role: "tenant",
        tier: "tenant_pro",
        cadence: "monthly",
        quote: {
          status: "ready",
          source: "legacy",
          provider: "stripe",
          providerMode: "live",
          currency: "GBP",
          amountMinor: 999,
          displayPrice: "£9.99",
          cadence: "monthly",
          marketCountry: "GB",
          marketCurrency: "GBP",
          marketLabel: "United Kingdom (£)",
          marketAligned: true,
          fallbackApplied: false,
          fallbackMessage: null,
          unavailableReason: null,
          resolutionKey: "SUBSCRIPTION_PRICE_BOOK:2",
          priceId: "price_1TGlYzPjtZ0fKtkBRTYNfytj",
        },
      },
    ],
  });

  assert.equal(entry.checkoutMatchesCanonical, true);
  assert.equal(entry.missingProviderRef, false);
  assert.deepEqual(entry.diagnostics, []);
});

void test("subscription price matrix marks linked corrected UK rows as canonical and aligned", () => {
  const [entry] = buildSubscriptionPriceMatrixEntries({
    canonicalRows: [
      {
        id: "3",
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
        display_order: 10,
        badge: null,
        operator_notes: null,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
        updated_by: null,
      },
    ],
    runtimeQuotes: [
      {
        marketCountry: "GB",
        marketCurrency: "GBP",
        role: "agent",
        tier: "pro",
        cadence: "yearly",
        quote: {
          status: "ready",
          source: "canonical",
          provider: "stripe",
          providerMode: "live",
          currency: "GBP",
          amountMinor: 38999,
          displayPrice: "£389.99",
          cadence: "yearly",
          marketCountry: "GB",
          marketCurrency: "GBP",
          marketLabel: "United Kingdom (£)",
          marketAligned: true,
          fallbackApplied: false,
          fallbackMessage: null,
          unavailableReason: null,
          resolutionKey: "SUBSCRIPTION_PRICE_BOOK:3",
          priceId: "price_1TGlb0PjtZ0fKtkBqgZX4RU1",
        },
      },
    ],
  });

  assert.equal(entry.checkoutMatchesCanonical, true);
  assert.equal(entry.missingProviderRef, false);
  assert.match(entry.diagnostics.join(" | "), /Canonical runtime/);
  assert.doesNotMatch(entry.diagnostics.join(" | "), /Missing provider ref/);
});
