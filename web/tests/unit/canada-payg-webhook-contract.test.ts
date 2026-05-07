import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  buildCanadaRentalPaygEntitlementGrantContract,
  buildCanadaRentalPaygPaymentPersistenceContract,
  executeCanadaRentalPaygWebhookContractDisabled,
  validateCanadaRentalPaygWebhookContract,
  type CanadaRentalPaygFutureEntitlementGrantContract,
  type CanadaRentalPaygFuturePaymentRecordContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import type { CanadaRentalPaygFulfilmentListingContext } from "@/lib/billing/canada-payg-fulfilment.server";

function buildListing(
  overrides: Partial<CanadaRentalPaygFulfilmentListingContext> = {}
): CanadaRentalPaygFulfilmentListingContext {
  return {
    id: "listing-ca-webhook-1",
    ownerId: "owner-ca-1",
    countryCode: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    ...overrides,
  };
}

function buildEvent(
  metadataOverrides: Record<string, string | null | undefined> = {},
  eventType = "checkout.session.completed"
): Pick<Stripe.Event, "type" | "id" | "data"> {
  return {
    id: "evt_ca_payg_1",
    type: eventType,
    data: {
      object: {
        id: "cs_ca_payg_1",
        object: "checkout.session",
        metadata: {
          purpose: "listing_submission",
          market: "CA",
          listing_id: "listing-ca-webhook-1",
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
          ...metadataOverrides,
        },
      },
    },
  } as unknown as Pick<Stripe.Event, "type" | "id" | "data">;
}

void test("Canada webhook contract accepts valid future checkout.session.completed metadata and builds disabled persistence contracts", () => {
  const validation = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(),
    listing: buildListing(),
    expectedPricing: { amountMinor: 400, currency: "CAD", provider: "stripe" },
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.reasonCode, "READY_FOR_DISABLED_WEBHOOK_CONTRACT");
  assert.equal(validation.parsedMetadata.listingId, "listing-ca-webhook-1");
  assert.equal(validation.fulfilmentValidation.reasonCode, "READY_FOR_DISABLED_FULFILMENT");

  const paymentContract = buildCanadaRentalPaygPaymentPersistenceContract(validation, {
    event: buildEvent(),
    checkoutSessionId: "cs_ca_payg_1",
    paymentIntentId: "pi_ca_payg_1",
  });
  const entitlementContract = buildCanadaRentalPaygEntitlementGrantContract(validation, {
    event: buildEvent(),
    checkoutSessionId: "cs_ca_payg_1",
  });

  const typedPaymentContract: CanadaRentalPaygFuturePaymentRecordContract = paymentContract;
  const typedEntitlementContract: CanadaRentalPaygFutureEntitlementGrantContract = entitlementContract;
  assert.equal(typedPaymentContract.table, "listing_payments");
  assert.equal(typedEntitlementContract.table, "canada_listing_payg_entitlements");
  assert.equal(typedEntitlementContract.schemaRequired, false);

  assert.deepEqual(paymentContract.fields, {
    listingId: "listing-ca-webhook-1",
    ownerId: "owner-ca-1",
    payerUserId: "user-ca-1",
    purpose: "listing_submission",
    market: "CA",
    provider: "stripe",
    currency: "CAD",
    amountMinor: 400,
    role: "landlord",
    tier: "free",
    productCode: "listing_submission",
    checkoutSessionId: "cs_ca_payg_1",
    paymentIntentId: "pi_ca_payg_1",
    stripeEventId: "evt_ca_payg_1",
    idempotencyKey: "canada_payg_payment:cs_ca_payg_1",
    status: "succeeded",
    pricingSource: "market_one_off_price_book",
  });

  assert.deepEqual(entitlementContract.fields, {
    listingId: "listing-ca-webhook-1",
    ownerId: "owner-ca-1",
    marketCountry: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amountMinor: 400,
    currency: "CAD",
    sourceCheckoutSessionId: "cs_ca_payg_1",
    sourcePaymentIntentId: null,
    sourceStripeEventId: "evt_ca_payg_1",
    idempotencyKey: "canada_payg_entitlement:evt_ca_payg_1",
    status: "granted",
    active: true,
    entitlementScope: "listing_scoped_extra_slot",
    unlockTarget: "listing_submission_recovery",
  });

  assert.equal(paymentContract.writeEnabled, false);
  assert.equal(entitlementContract.grantEnabled, false);

  const disabled = executeCanadaRentalPaygWebhookContractDisabled(validation, {
    event: buildEvent(),
    checkoutSessionId: "cs_ca_payg_1",
    paymentIntentId: "pi_ca_payg_1",
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.liveWebhookFulfilmentEnabled, false);
  assert.equal(disabled.wouldMutate, true);
  assert.equal(disabled.mutated, false);
  assert.equal(disabled.paymentRecordCreated, false);
  assert.equal(disabled.entitlementGranted, false);
  assert.equal(disabled.listingUnlocked, false);
  assert.equal(disabled.listingStatusChanged, false);
  assert.equal(disabled.fulfilmentWriteExecution.mutated, false);
  assert.equal(disabled.fulfilmentWriteExecution.wouldCreatePayment, true);
  assert.equal(disabled.fulfilmentWriteExecution.wouldGrantEntitlement, true);
  assert.equal(disabled.fulfilmentWriteExecution.paymentInsertPayload.provider_ref, "pi_ca_payg_1");
  assert.equal(disabled.fulfilmentWriteExecution.paymentInsertPayload.idempotency_key, "canada_payg_payment:cs_ca_payg_1");
  assert.equal(disabled.fulfilmentWriteExecution.entitlementInsertPayload.idempotency_key, "canada_payg_entitlement:evt_ca_payg_1");
});

void test("Canada webhook contract rejects wrong event type", () => {
  const validation = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({}, "invoice.payment_succeeded"),
    listing: buildListing(),
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.reasonCode, "UNSUPPORTED_EVENT_TYPE");
});

void test("Canada webhook contract rejects wrong market, provider, purpose, and missing listing id", () => {
  const wrongMarket = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ market: "NG" }),
    listing: buildListing(),
  });
  assert.equal(wrongMarket.ok, false);
  assert.equal(wrongMarket.reasonCode, "WRONG_MARKET");

  const wrongProvider = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ provider: "paystack" }),
    listing: buildListing(),
  });
  assert.equal(wrongProvider.ok, false);
  assert.equal(wrongProvider.reasonCode, "WRONG_PROVIDER");

  const wrongPurpose = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ purpose: "featured_listing" }),
    listing: buildListing(),
  });
  assert.equal(wrongPurpose.ok, false);
  assert.equal(wrongPurpose.reasonCode, "WRONG_PURPOSE");

  const missingListingId = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ listing_id: "" }),
    listing: buildListing(),
  });
  assert.equal(missingListingId.ok, false);
  assert.equal(missingListingId.reasonCode, "MISSING_LISTING_ID");
});

void test("Canada webhook contract rejects enterprise, tenant, shortlet, sale, and off-plan contexts", () => {
  const enterprise = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ tier: "enterprise", role: "agent" }),
    listing: buildListing(),
  });
  assert.equal(enterprise.ok, false);
  assert.equal(enterprise.reasonCode, "ENTERPRISE_PLANNING_ONLY");

  const tenant = validateCanadaRentalPaygWebhookContract({
    event: buildEvent({ role: "tenant" }),
    listing: buildListing(),
  });
  assert.equal(tenant.ok, false);
  assert.equal(tenant.reasonCode, "TENANT_DEMAND_ONLY");

  const shortlet = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(),
    listing: buildListing({ rentalType: "short_let" }),
  });
  assert.equal(shortlet.ok, false);
  assert.equal(shortlet.reasonCode, "SHORTLET_EXCLUDED");

  const sale = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(),
    listing: buildListing({ listingIntent: "sale" }),
  });
  assert.equal(sale.ok, false);
  assert.equal(sale.reasonCode, "SALE_DEFERRED");

  const offPlan = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(),
    listing: buildListing({ listingIntent: "off_plan" }),
  });
  assert.equal(offPlan.ok, false);
  assert.equal(offPlan.reasonCode, "OFF_PLAN_DEFERRED");
});
