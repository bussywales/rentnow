import test from "node:test";
import assert from "node:assert/strict";
import { prepareCanadaRentalPaygStripeCheckout } from "@/lib/billing/canada-payg-stripe-prep.server";
import type { CanadaRentalPaygReadinessResult } from "@/lib/billing/canada-payg-readiness.server";

function buildReadiness(
  overrides: Partial<CanadaRentalPaygReadinessResult> = {}
): CanadaRentalPaygReadinessResult {
  return {
    status: "ready",
    eligible: true,
    reasonCode: "READY_FOR_RUNTIME_INTEGRATION",
    blockers: [],
    marketCountry: "CA",
    role: "landlord",
    tier: "free",
    normalizedIntent: "rent",
    isShortlet: false,
    policyState: "live",
    activeListingCount: 3,
    includedActiveListingLimit: 3,
    overIncludedCap: true,
    policyRow: null,
    entitlementRow: null,
    priceRow: null,
    amountMinor: 400,
    currency: "CAD",
    provider: "stripe",
    runtimeActivationAllowed: true,
    checkoutEnabled: false,
    warnings: [],
    ...overrides,
  };
}

void test("Stripe prep builds CAD/Stripe payment payload for a valid CA landlord/free readiness result", () => {
  const prepared = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-1",
    ownerId: "owner-ca-1",
    userId: "user-ca-1",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "CAD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness(),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });

  assert.equal(prepared.ready, true);
  assert.equal(prepared.blockedReason, null);
  assert.equal(prepared.amountMinor, 400);
  assert.equal(prepared.currency, "CAD");
  assert.equal(prepared.provider, "stripe");
  assert.equal(prepared.mode, "payment");
  assert.equal(prepared.checkoutCreationEnabled, false);
  assert.equal(prepared.lineItems.length, 1);
  assert.equal(prepared.lineItems[0]?.price_data.currency, "cad");
  assert.equal(prepared.lineItems[0]?.price_data.unit_amount, 400);
  assert.match(prepared.successUrl, /payment=canada_payg/);
  assert.match(prepared.successUrl, /canada_payg=success/);
  assert.match(prepared.cancelUrl, /canada_payg=cancel/);
});

void test("Stripe prep builds the CA$2 agent/pro payload and includes required metadata", () => {
  const prepared = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-2",
    ownerId: "owner-ca-2",
    userId: "user-ca-2",
    role: "agent",
    tier: "pro",
    amountMinor: 200,
    currency: "CAD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness({
      role: "agent",
      tier: "pro",
      amountMinor: 200,
    }),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
    idempotencyKey: "idem-agent-pro-123",
  });

  assert.equal(prepared.ready, true);
  assert.equal(prepared.amountMinor, 200);
  assert.equal(prepared.idempotencyKey, "idem-agent-pro-123");
  assert.equal(prepared.metadata.purpose, "listing_submission");
  assert.equal(prepared.metadata.market, "CA");
  assert.equal(prepared.metadata.listing_id, "listing-ca-2");
  assert.equal(prepared.metadata.owner_id, "owner-ca-2");
  assert.equal(prepared.metadata.payer_user_id, "user-ca-2");
  assert.equal(prepared.metadata.role, "agent");
  assert.equal(prepared.metadata.tier, "pro");
  assert.equal(prepared.metadata.product_code, "listing_submission");
  assert.equal(prepared.metadata.pricing_source, "market_one_off_price_book");
  assert.equal(prepared.metadata.provider, "stripe");
  assert.equal(prepared.metadata.currency, "CAD");
  assert.equal(prepared.metadata.amount_minor, "200");
  assert.equal(prepared.metadata.checkout_enabled, "false");
});

void test("Stripe prep keeps checkoutCreationEnabled false even when runtime readiness is activation-ready", () => {
  const prepared = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-3",
    ownerId: "owner-ca-3",
    userId: "user-ca-3",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "CAD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness(),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });

  assert.equal(prepared.ready, true);
  assert.equal(prepared.checkoutCreationEnabled, false);
});

void test("Stripe prep blocks provider, currency, readiness, and enterprise violations", () => {
  const providerBlocked = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-4",
    ownerId: "owner-ca-4",
    userId: "user-ca-4",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "CAD",
    provider: "paystack",
    marketCountry: "CA",
    readiness: buildReadiness({ provider: "paystack" }),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });
  assert.equal(providerBlocked.ready, false);
  assert.equal(providerBlocked.blockedReason, "PROVIDER_NOT_STRIPE");

  const currencyBlocked = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-5",
    ownerId: "owner-ca-5",
    userId: "user-ca-5",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "USD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness({ currency: "USD" }),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });
  assert.equal(currencyBlocked.ready, false);
  assert.equal(currencyBlocked.blockedReason, "CURRENCY_NOT_CAD");

  const readinessBlocked = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-6",
    ownerId: "owner-ca-6",
    userId: "user-ca-6",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "CAD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness({
      status: "blocked",
      reasonCode: "PRICE_ROW_DISABLED",
      blockers: ["PRICE_ROW_DISABLED"],
      runtimeActivationAllowed: false,
    }),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });
  assert.equal(readinessBlocked.ready, false);
  assert.equal(readinessBlocked.blockedReason, "READINESS_NOT_ACTIVATION_ALLOWED");

  const enterpriseBlocked = prepareCanadaRentalPaygStripeCheckout({
    listingId: "listing-ca-7",
    ownerId: "owner-ca-7",
    userId: "user-ca-7",
    role: "agent",
    tier: "enterprise",
    amountMinor: 100,
    currency: "CAD",
    provider: "stripe",
    marketCountry: "CA",
    readiness: buildReadiness({
      role: "agent",
      tier: "enterprise",
      amountMinor: 100,
      reasonCode: "ENTERPRISE_PLANNING_ONLY",
    }),
    successUrlBase: "https://www.propatyhub.com",
    cancelUrlBase: "https://www.propatyhub.com",
  });
  assert.equal(enterpriseBlocked.ready, false);
  assert.equal(enterpriseBlocked.blockedReason, "ENTERPRISE_PLANNING_ONLY");
});
