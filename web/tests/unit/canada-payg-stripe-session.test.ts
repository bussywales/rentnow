import test from "node:test";
import assert from "node:assert/strict";
import { prepareCanadaRentalPaygStripeCheckout } from "@/lib/billing/canada-payg-stripe-prep.server";
import {
  buildCanadaRentalPaygStripeSessionRequest,
  createCanadaRentalPaygStripeSessionDisabled,
  parseCanadaRentalPaygStripeSuccessMetadata,
} from "@/lib/billing/canada-payg-stripe-session.server";
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

function buildPreparedCheckout(overrides: Partial<Parameters<typeof prepareCanadaRentalPaygStripeCheckout>[0]> = {}) {
  return prepareCanadaRentalPaygStripeCheckout({
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
    ...overrides,
  });
}

void test("disabled Stripe session helper builds the future session request from a valid CA landlord/free prepared payload", () => {
  const prepared = buildPreparedCheckout();
  const session = buildCanadaRentalPaygStripeSessionRequest({
    prepared,
    customerEmail: "owner@example.com",
  });

  assert.equal(session.ready, true);
  assert.equal(session.blockedReason, null);
  assert.equal(session.request?.mode, "payment");
  assert.equal(session.request?.line_items.length, 1);
  assert.equal(session.request?.line_items[0]?.price_data?.currency, "cad");
  assert.equal(session.request?.line_items[0]?.price_data?.unit_amount, 400);
  assert.equal(session.request?.customer_email, "owner@example.com");
  assert.equal(session.request?.metadata?.provider, "stripe");
  assert.equal(session.request?.metadata?.currency, "CAD");
  assert.equal(session.request?.payment_intent_data?.metadata?.listing_id, "listing-ca-1");
  assert.equal(session.request?.idempotencyKey, prepared.idempotencyKey);
});

void test("disabled Stripe session helper builds the CA$2 agent/pro session request and never enables creation", () => {
  const prepared = buildPreparedCheckout({
    listingId: "listing-ca-2",
    ownerId: "owner-ca-2",
    userId: "user-ca-2",
    role: "agent",
    tier: "pro",
    amountMinor: 200,
    readiness: buildReadiness({
      role: "agent",
      tier: "pro",
      amountMinor: 200,
    }),
    idempotencyKey: "idem-ca-agent-pro-200",
  });
  const session = createCanadaRentalPaygStripeSessionDisabled({
    prepared,
    customerEmail: "agent@example.com",
  });

  assert.equal(session.ready, false);
  assert.equal(session.blockedReason, "CHECKOUT_CREATION_DISABLED");
  assert.equal(session.request?.line_items[0]?.price_data?.unit_amount, 200);
  assert.equal(session.request?.payment_intent_data?.metadata?.tier, "pro");
  assert.equal(session.request?.payment_intent_data?.metadata?.amount_minor, "200");
  assert.equal(session.idempotencyKey, "idem-ca-agent-pro-200");
  assert.equal(session.checkoutCreationEnabled, false);
  assert.equal(session.stripeSessionCreationAttempted, false);
});

void test("disabled Stripe session helper blocks if Stripe prep is not activation-ready", () => {
  const prepared = buildPreparedCheckout({
    readiness: buildReadiness({
      status: "blocked",
      reasonCode: "PRICE_ROW_DISABLED",
      blockers: ["PRICE_ROW_DISABLED"],
      runtimeActivationAllowed: false,
    }),
  });
  const session = buildCanadaRentalPaygStripeSessionRequest({ prepared });

  assert.equal(session.ready, false);
  assert.equal(session.blockedReason, "PREP_NOT_READY");
  assert.equal(session.request, null);
  assert.equal(session.checkoutCreationEnabled, false);
  assert.equal(session.stripeSessionCreationAttempted, false);
});

void test("Canada Stripe recovery parser accepts valid listing-submission metadata", () => {
  const parsed = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    listing_id: "listing-ca-3",
    owner_id: "owner-ca-3",
    payer_user_id: "user-ca-3",
    role: "landlord",
    tier: "free",
    product_code: "listing_submission",
    pricing_source: "market_one_off_price_book",
    provider: "stripe",
    currency: "CAD",
    amount_minor: "400",
    checkout_enabled: "false",
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.status, "scaffolded_not_live");
  assert.equal(parsed.readyForFulfilment, false);
  assert.equal(parsed.metadata.market, "CA");
  assert.equal(parsed.metadata.provider, "stripe");
  assert.equal(parsed.metadata.listingId, "listing-ca-3");
  assert.equal(parsed.metadata.tier, "free");
  assert.equal(parsed.metadata.amountMinor, 400);
});

void test("Canada Stripe recovery parser rejects wrong market, provider, and purpose", () => {
  const wrongMarket = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "NG",
    listing_id: "listing-ca-4",
    provider: "stripe",
  });
  assert.equal(wrongMarket.ok, false);
  if (!wrongMarket.ok) assert.equal(wrongMarket.error, "WRONG_MARKET");

  const wrongProvider = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    listing_id: "listing-ca-4",
    provider: "paystack",
  });
  assert.equal(wrongProvider.ok, false);
  if (!wrongProvider.ok) assert.equal(wrongProvider.error, "WRONG_PROVIDER");

  const wrongPurpose = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "featured_listing",
    market: "CA",
    listing_id: "listing-ca-4",
    provider: "stripe",
  });
  assert.equal(wrongPurpose.ok, false);
  if (!wrongPurpose.ok) assert.equal(wrongPurpose.error, "WRONG_PURPOSE");
});

void test("Canada Stripe recovery parser rejects missing listing id and enterprise planning-only rows", () => {
  const missingListing = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    provider: "stripe",
  });
  assert.equal(missingListing.ok, false);
  if (!missingListing.ok) assert.equal(missingListing.error, "MISSING_LISTING_ID");

  const enterprise = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    listing_id: "listing-ca-5",
    provider: "stripe",
    tier: "enterprise",
  });
  assert.equal(enterprise.ok, false);
  if (!enterprise.ok) assert.equal(enterprise.error, "ENTERPRISE_PLANNING_ONLY");
});
