import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanadaListingPaygEntitlementInsertPayload,
  findActiveCanadaListingPaygEntitlement,
  grantCanadaListingPaygEntitlementDisabled,
  listingHasActiveCanadaPaygExtraSlot,
  validateCanadaListingPaygEntitlementContract,
  type CanadaListingPaygEntitlementRow,
} from "@/lib/billing/canada-payg-entitlements.server";
import {
  buildCanadaRentalPaygEntitlementGrantContract,
  validateCanadaRentalPaygWebhookContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import type Stripe from "stripe";
import type { CanadaRentalPaygFulfilmentListingContext } from "@/lib/billing/canada-payg-fulfilment.server";

function buildListing(
  overrides: Partial<CanadaRentalPaygFulfilmentListingContext> = {}
): CanadaRentalPaygFulfilmentListingContext {
  return {
    id: "listing-ca-entitlement-1",
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
    id: "evt_ca_entitlement_1",
    type: eventType,
    data: {
      object: {
        id: "cs_ca_entitlement_1",
        object: "checkout.session",
        metadata: {
          purpose: "listing_submission",
          market: "CA",
          listing_id: "listing-ca-entitlement-1",
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

function buildGrantContract(overrides: {
  metadataOverrides?: Record<string, string | null | undefined>;
  listingOverrides?: Partial<CanadaRentalPaygFulfilmentListingContext>;
  paymentIntentId?: string | null;
} = {}) {
  const validation = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(overrides.metadataOverrides),
    listing: buildListing(overrides.listingOverrides),
    expectedPricing: { amountMinor: 400, currency: "CAD", provider: "stripe" },
  });

  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error(`expected valid contract, got ${validation.reasonCode}`);

  return buildCanadaRentalPaygEntitlementGrantContract(validation, {
    event: buildEvent(overrides.metadataOverrides),
    checkoutSessionId: "cs_ca_entitlement_1",
    paymentIntentId: overrides.paymentIntentId ?? "pi_ca_entitlement_1",
  });
}

void test("Canada entitlement helper builds a disabled insert payload from a valid webhook contract", async () => {
  const contract = buildGrantContract();
  const validation = validateCanadaListingPaygEntitlementContract(contract);
  assert.equal(validation.ok, true);

  const payload = buildCanadaListingPaygEntitlementInsertPayload(contract, "2026-05-07T11:00:00.000Z");
  assert.deepEqual(payload, {
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {
      entitlement_scope: "listing_scoped_extra_slot",
      unlock_target: "listing_submission_recovery",
      source: "stripe_checkout_session_completed",
      inserted_by_live_runtime: false,
    },
  });

  const disabled = await grantCanadaListingPaygEntitlementDisabled({
    contract,
    grantedAt: "2026-05-07T11:00:00.000Z",
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.wouldInsert, true);
  assert.equal(disabled.inserted, false);
  assert.equal(disabled.payload.idempotency_key, "canada_payg_entitlement:evt_ca_entitlement_1");
});

void test("Canada entitlement helper rejects wrong market/provider/currency/purpose", () => {
  const baseContract = buildGrantContract();

  const wrongMarket = validateCanadaListingPaygEntitlementContract({
    ...baseContract,
    fields: { ...baseContract.fields, marketCountry: "NG" as "CA" },
  });
  assert.equal(wrongMarket.ok, false);
  if (!wrongMarket.ok) assert.equal(wrongMarket.reason, "WRONG_MARKET");

  const wrongProvider = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, provider: "paystack" as const } }
  );
  assert.equal(wrongProvider.ok, false);
  if (!wrongProvider.ok) assert.equal(wrongProvider.reason, "WRONG_PROVIDER");

  const wrongCurrency = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, currency: "NGN" as const } }
  );
  assert.equal(wrongCurrency.ok, false);
  if (!wrongCurrency.ok) assert.equal(wrongCurrency.reason, "WRONG_CURRENCY");

  const wrongPurpose = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, purpose: "featured_listing" as const } }
  );
  assert.equal(wrongPurpose.ok, false);
  if (!wrongPurpose.ok) assert.equal(wrongPurpose.reason, "WRONG_PURPOSE");
});

void test("Canada entitlement helper rejects tenant and enterprise while preserving idempotency rules", () => {
  const baseContract = buildGrantContract();
  const tenant = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, role: "tenant", tier: "free" } }
  );
  assert.equal(tenant.ok, false);
  if (!tenant.ok) assert.equal(tenant.reason, "INVALID_ROLE");

  const enterprise = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, role: "agent", tier: "enterprise" } }
  );
  assert.equal(enterprise.ok, false);
  if (!enterprise.ok) assert.equal(enterprise.reason, "INVALID_TIER");

  const missingIdempotency = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, idempotencyKey: "" } }
  );
  assert.equal(missingIdempotency.ok, false);
  if (!missingIdempotency.ok) assert.equal(missingIdempotency.reason, "MISSING_IDEMPOTENCY_KEY");
});

void test("Canada entitlement lookup helper only treats active granted rows as valid extra slots", async () => {
  const activeRow: CanadaListingPaygEntitlementRow = {
    id: "ent-1",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  const consumedRow = { ...activeRow, id: "ent-2", status: "consumed" as const, active: false, consumed_at: "2026-05-08T00:00:00.000Z" };

  const chain = {
    eq() {
      return chain;
    },
    async order() {
      return { data: [consumedRow, activeRow] };
    },
  };

  const client = {
    from: () => ({
      select: () => chain,
    }),
  } as never;

  const row = await findActiveCanadaListingPaygEntitlement({
    client,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.equal(row?.id, "ent-1");

  const summary = await listingHasActiveCanadaPaygExtraSlot({
    client,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.equal(summary.hasActiveEntitlement, true);
  assert.equal(summary.entitlement?.id, "ent-1");
});
