import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  buildCanadaListingPaymentInsertPayload,
  persistCanadaListingPayment,
  persistCanadaListingPaymentDisabled,
  validateCanadaListingPaymentPersistenceContract,
} from "@/lib/billing/canada-payg-payment-persistence.server";
import {
  buildCanadaRentalPaygPaymentPersistenceContract,
  validateCanadaRentalPaygWebhookContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import type { CanadaRentalPaygFulfilmentListingContext } from "@/lib/billing/canada-payg-fulfilment.server";

function buildListing(
  overrides: Partial<CanadaRentalPaygFulfilmentListingContext> = {}
): CanadaRentalPaygFulfilmentListingContext {
  return {
    id: "listing-ca-payment-1",
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
    id: "evt_ca_payment_1",
    type: eventType,
    data: {
      object: {
        id: "cs_ca_payment_1",
        object: "checkout.session",
        metadata: {
          purpose: "listing_submission",
          market: "CA",
          listing_id: "listing-ca-payment-1",
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

function buildPaymentContract(overrides: {
  metadataOverrides?: Record<string, string | null | undefined>;
  listingOverrides?: Partial<CanadaRentalPaygFulfilmentListingContext>;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
} = {}) {
  const validation = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(overrides.metadataOverrides),
    listing: buildListing(overrides.listingOverrides),
    expectedPricing: { amountMinor: 400, currency: "CAD", provider: "stripe" },
  });

  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error(`expected valid payment contract, got ${validation.reasonCode}`);

  return buildCanadaRentalPaygPaymentPersistenceContract(validation, {
    event: buildEvent(overrides.metadataOverrides),
    checkoutSessionId: overrides.checkoutSessionId === undefined ? "cs_ca_payment_1" : overrides.checkoutSessionId,
    paymentIntentId: overrides.paymentIntentId === undefined ? "pi_ca_payment_1" : overrides.paymentIntentId,
  });
}

void test("Canada payment persistence helper builds a disabled listing_payments payload from a valid webhook contract", async () => {
  const contract = buildPaymentContract();
  const validation = validateCanadaListingPaymentPersistenceContract(contract);
  assert.equal(validation.ok, true);

  const payload = buildCanadaListingPaymentInsertPayload(contract, "2026-05-07T12:00:00.000Z");
  assert.deepEqual(payload, {
    user_id: "owner-ca-1",
    listing_id: "listing-ca-payment-1",
    amount: 4,
    currency: "CAD",
    status: "paid",
    provider: "stripe",
    provider_ref: "pi_ca_payment_1",
    idempotency_key: "canada_payg_payment:cs_ca_payment_1",
    paid_at: "2026-05-07T12:00:00.000Z",
    created_at: "2026-05-07T12:00:00.000Z",
    updated_at: "2026-05-07T12:00:00.000Z",
  });

  let insertCalls = 0;
  const disabled = await persistCanadaListingPaymentDisabled({
    contract,
    paidAt: "2026-05-07T12:00:00.000Z",
    client: {
      from() {
        insertCalls += 1;
        throw new Error("disabled helper must not insert");
      },
    } as never,
  });

  assert.equal(disabled.enabled, false);
  assert.equal(disabled.wouldInsert, true);
  assert.equal(disabled.inserted, false);
  assert.equal(disabled.payload.idempotency_key, "canada_payg_payment:cs_ca_payment_1");
  assert.equal(disabled.stripeReferences.checkoutSessionId, "cs_ca_payment_1");
  assert.equal(disabled.stripeReferences.paymentIntentId, "pi_ca_payment_1");
  assert.equal(disabled.stripeReferences.stripeEventId, "evt_ca_payment_1");
  assert.equal(disabled.stripeReferences.canonicalProviderRef, "pi_ca_payment_1");
  assert.equal(insertCalls, 0);
});

void test("Canada payment persistence helper rejects wrong provider, market, currency, and purpose", () => {
  const baseContract = buildPaymentContract();

  const wrongMarket = validateCanadaListingPaymentPersistenceContract({
    ...baseContract,
    fields: { ...baseContract.fields, market: "NG" as "CA" },
  });
  assert.equal(wrongMarket.ok, false);
  if (!wrongMarket.ok) assert.equal(wrongMarket.reason, "WRONG_MARKET");

  const wrongProvider = validateCanadaListingPaymentPersistenceContract({
    ...baseContract,
    fields: { ...baseContract.fields, provider: "paystack" as "stripe" },
  });
  assert.equal(wrongProvider.ok, false);
  if (!wrongProvider.ok) assert.equal(wrongProvider.reason, "WRONG_PROVIDER");

  const wrongCurrency = validateCanadaListingPaymentPersistenceContract({
    ...baseContract,
    fields: { ...baseContract.fields, currency: "NGN" as "CAD" },
  });
  assert.equal(wrongCurrency.ok, false);
  if (!wrongCurrency.ok) assert.equal(wrongCurrency.reason, "WRONG_CURRENCY");

  const wrongPurpose = validateCanadaListingPaymentPersistenceContract({
    ...baseContract,
    fields: { ...baseContract.fields, purpose: "featured_listing" as "listing_submission" },
  });
  assert.equal(wrongPurpose.ok, false);
  if (!wrongPurpose.ok) assert.equal(wrongPurpose.reason, "WRONG_PURPOSE");
});

void test("Canada payment persistence helper preserves idempotency and falls back canonical provider_ref when payment_intent is absent", () => {
  const contract = buildPaymentContract({ paymentIntentId: null });
  const payload = buildCanadaListingPaymentInsertPayload(contract, "2026-05-07T12:00:00.000Z");

  assert.equal(contract.fields.idempotencyKey, "canada_payg_payment:cs_ca_payment_1");
  assert.equal(payload.idempotency_key, "canada_payg_payment:cs_ca_payment_1");
  assert.equal(payload.provider_ref, "cs_ca_payment_1");
});

void test("Canada payment persistence helper inserts when execution is enabled", async () => {
  const contract = buildPaymentContract();
  const inserts: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      if (table !== "listing_payments") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
        insert: async (payload: Record<string, unknown>) => {
          inserts.push(payload);
          return { error: null };
        },
      };
    },
  } as never;

  const result = await persistCanadaListingPayment({
    contract,
    client,
    enabled: true,
    paidAt: "2026-05-07T12:00:00.000Z",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.inserted, true);
  assert.equal(result.duplicate, false);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]?.provider_ref, "pi_ca_payment_1");
});

void test("Canada payment persistence helper treats duplicate insert races as a no-op", async () => {
  const contract = buildPaymentContract();
  let selects = 0;
  const client = {
    from(table: string) {
      if (table !== "listing_payments") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              selects += 1;
              return {
                eq() {
                  return {
                    maybeSingle: async () =>
                      selects < 3
                        ? { data: null, error: null }
                        : {
                            data: {
                              id: "payment-1",
                              idempotency_key: "canada_payg_payment:cs_ca_payment_1",
                              provider: "stripe",
                              provider_ref: "pi_ca_payment_1",
                            },
                            error: null,
                          },
                  };
                },
                maybeSingle: async () =>
                  selects < 3
                    ? { data: null, error: null }
                    : {
                        data: {
                          id: "payment-1",
                          idempotency_key: "canada_payg_payment:cs_ca_payment_1",
                          provider: "stripe",
                          provider_ref: "pi_ca_payment_1",
                        },
                        error: null,
                      },
              };
            },
          };
        },
        insert: async () => ({
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      };
    },
  } as never;

  const result = await persistCanadaListingPayment({
    contract,
    client,
    enabled: true,
    paidAt: "2026-05-07T12:00:00.000Z",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.inserted, false);
  assert.equal(result.duplicate, true);
});
