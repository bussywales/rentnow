import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanadaRentalPaygFulfilmentPlan,
  executeCanadaRentalPaygFulfilmentDisabled,
  validateCanadaRentalPaygFulfilmentInput,
  type CanadaRentalPaygFulfilmentListingContext,
} from "@/lib/billing/canada-payg-fulfilment.server";
import { parseCanadaRentalPaygStripeSuccessMetadata } from "@/lib/billing/canada-payg-stripe-session.server";

function buildListing(
  overrides: Partial<CanadaRentalPaygFulfilmentListingContext> = {}
): CanadaRentalPaygFulfilmentListingContext {
  return {
    id: "listing-ca-fulfilment-1",
    ownerId: "owner-ca-1",
    countryCode: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    ...overrides,
  };
}

function buildParsedMetadata(
  overrides: Record<string, string | null | undefined> = {}
) {
  const parsed = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    listing_id: "listing-ca-fulfilment-1",
    owner_id: "owner-ca-1",
    payer_user_id: "user-ca-1",
    role: "landlord",
    tier: "free",
    product_code: "listing_submission",
    pricing_source: "market_one_off_price_book",
    provider: "stripe",
    currency: "CAD",
    amount_minor: "400",
    checkout_enabled: "false",
    ...overrides,
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected parsed Canada metadata");
  return parsed.metadata;
}

void test("Canada fulfilment scaffold accepts valid parsed listing_submission metadata and builds a disabled action plan", () => {
  const validation = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata(),
    listing: buildListing(),
    expectedPricing: {
      amountMinor: 400,
      currency: "CAD",
      provider: "stripe",
    },
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.reasonCode, "READY_FOR_DISABLED_FULFILMENT");
  assert.equal(validation.role, "landlord");
  assert.equal(validation.tier, "free");

  const plan = buildCanadaRentalPaygFulfilmentPlan(validation);
  assert.equal(plan.ready, true);
  assert.equal(plan.paymentRecordModel, "listing_payments");
  assert.equal(plan.entitlementModel, "canada_listing_payg_entitlements");
  assert.equal(
    plan.futurePaidSlotModel,
    "provider-backed one-off payment plus persisted listing-scoped extra-slot entitlement"
  );
  assert.deepEqual(
    plan.actions.map((action) => action.key),
    [
      "verify_metadata",
      "verify_listing_context",
      "record_payment",
      "grant_paid_extra_entitlement",
      "unlock_listing_submission",
      "log_audit_event",
      "return_to_listing_recovery",
    ]
  );
  assert.ok(plan.actions.every((action) => action.enabled === false));
  assert.equal(plan.paymentRecordWriteEnabled, false);
  assert.equal(plan.entitlementGrantEnabled, false);
  assert.equal(plan.listingUnlockEnabled, false);

  const result = executeCanadaRentalPaygFulfilmentDisabled(plan);
  assert.equal(result.enabled, false);
  assert.equal(result.wouldMutate, true);
  assert.equal(result.mutated, false);
  assert.equal(result.paymentRecordCreated, false);
  assert.equal(result.entitlementGranted, false);
  assert.equal(result.listingUnlocked, false);
  assert.equal(result.listingStatusChanged, false);
});

void test("Canada fulfilment scaffold rejects wrong market, wrong provider, and wrong purpose", () => {
  const wrongMarket = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata(),
    listing: buildListing({ countryCode: "NG" }),
  });
  assert.equal(wrongMarket.ok, false);
  assert.equal(wrongMarket.reasonCode, "WRONG_MARKET");

  const wrongProvider = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata(),
    listing: buildListing(),
    expectedPricing: { provider: "paystack" },
  });
  assert.equal(wrongProvider.ok, false);
  assert.equal(wrongProvider.reasonCode, "PROVIDER_MISMATCH");

  const wrongPurposeParsed = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "featured_listing",
    market: "CA",
    listing_id: "listing-ca-fulfilment-1",
    provider: "stripe",
  });
  assert.equal(wrongPurposeParsed.ok, false);
  if (!wrongPurposeParsed.ok) {
    assert.equal(wrongPurposeParsed.error, "WRONG_PURPOSE");
  }
});

void test("Canada fulfilment scaffold rejects missing listing id, tenant role, and enterprise tier", () => {
  const missingListingParsed = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    provider: "stripe",
  });
  assert.equal(missingListingParsed.ok, false);
  if (!missingListingParsed.ok) {
    assert.equal(missingListingParsed.error, "MISSING_LISTING_ID");
  }

  const tenantValidation = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata({ role: "tenant" }),
    listing: buildListing(),
  });
  assert.equal(tenantValidation.ok, false);
  assert.equal(tenantValidation.reasonCode, "TENANT_DEMAND_ONLY");

  const enterpriseParsed = parseCanadaRentalPaygStripeSuccessMetadata({
    purpose: "listing_submission",
    market: "CA",
    listing_id: "listing-ca-fulfilment-1",
    provider: "stripe",
    tier: "enterprise",
  });
  assert.equal(enterpriseParsed.ok, false);
  if (!enterpriseParsed.ok) {
    assert.equal(enterpriseParsed.error, "ENTERPRISE_PLANNING_ONLY");
  }
});

void test("Canada fulfilment scaffold rejects shortlet, sale, and off-plan listing contexts", () => {
  const metadata = buildParsedMetadata();

  const shortletValidation = validateCanadaRentalPaygFulfilmentInput({
    metadata,
    listing: buildListing({ listingIntent: "rent", rentalType: "short_let" }),
  });
  assert.equal(shortletValidation.ok, false);
  assert.equal(shortletValidation.reasonCode, "SHORTLET_EXCLUDED");

  const saleValidation = validateCanadaRentalPaygFulfilmentInput({
    metadata,
    listing: buildListing({ listingIntent: "sale" }),
  });
  assert.equal(saleValidation.ok, false);
  assert.equal(saleValidation.reasonCode, "SALE_DEFERRED");

  const offPlanValidation = validateCanadaRentalPaygFulfilmentInput({
    metadata,
    listing: buildListing({ listingIntent: "off_plan" }),
  });
  assert.equal(offPlanValidation.ok, false);
  assert.equal(offPlanValidation.reasonCode, "OFF_PLAN_DEFERRED");
});

void test("Canada fulfilment scaffold rejects missing listing context and amount mismatch", () => {
  const noListing = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata(),
    listing: null,
  });
  assert.equal(noListing.ok, false);
  assert.equal(noListing.reasonCode, "LISTING_NOT_FOUND");

  const amountMismatch = validateCanadaRentalPaygFulfilmentInput({
    metadata: buildParsedMetadata(),
    listing: buildListing(),
    expectedPricing: {
      amountMinor: 500,
      currency: "CAD",
      provider: "stripe",
    },
  });
  assert.equal(amountMismatch.ok, false);
  assert.equal(amountMismatch.reasonCode, "AMOUNT_MISMATCH");
});
