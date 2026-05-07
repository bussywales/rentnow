import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  postBillingStripeWebhookResponse,
  type BillingStripeWebhookRouteDeps,
} from "@/app/api/billing/stripe/webhook/route";
import {
  buildCanadaRentalPaygEntitlementGrantContract,
  buildCanadaRentalPaygPaymentPersistenceContract,
  validateCanadaRentalPaygWebhookContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import { executeCanadaRentalPaygFulfilmentPayloads } from "@/lib/billing/canada-payg-fulfilment.server";

type StripeWebhookEventRow = Record<string, unknown>;

type WebhookHarnessState = {
  webhookEvents: Map<string, StripeWebhookEventRow>;
  listingPayments: Record<string, unknown>[];
  entitlements: Record<string, unknown>[];
  processStripeEventCalls: number;
};

function buildCanadaCheckoutCompletedEvent(overrides: {
  metadata?: Record<string, string>;
  eventId?: string;
  sessionId?: string;
  paymentIntentId?: string;
} = {}): Stripe.Event {
  return {
    id: overrides.eventId ?? "evt_ca_live_1",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: overrides.sessionId ?? "cs_ca_live_1",
        object: "checkout.session",
        mode: "payment",
        payment_intent: overrides.paymentIntentId ?? "pi_ca_live_1",
        metadata: {
          purpose: "listing_submission",
          market: "CA",
          listing_id: "listing-ca-live-1",
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
          ...(overrides.metadata ?? {}),
        },
      },
    },
  } as unknown as Stripe.Event;
}

function buildSubscriptionCheckoutCompletedEvent(): Stripe.Event {
  return {
    id: "evt_subscription_1",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_subscription_1",
        object: "checkout.session",
        mode: "subscription",
        subscription: "sub_123",
        metadata: {
          profile_id: "profile-1",
          plan_tier: "tenant_pro",
          subscription_market_country: "CA",
          subscription_market_currency: "CAD",
        },
      },
    },
  } as unknown as Stripe.Event;
}

function createAdminClient(state: WebhookHarnessState) {
  const propertiesRow = {
    id: "listing-ca-live-1",
    owner_id: "owner-ca-1",
    country_code: "CA",
    listing_intent: "rent",
    rental_type: "long_term",
  };

  return {
    from(table: string) {
      if (table === "stripe_webhook_events") {
        return {
          insert: async (values: Record<string, unknown>) => {
            const eventId = String(values.event_id ?? "");
            if (state.webhookEvents.has(eventId)) {
              return { error: { code: "23505", message: "duplicate event" } };
            }
            state.webhookEvents.set(eventId, { ...values });
            return { error: null };
          },
          select() {
            return {
              eq(_column: string, eventId: string) {
                return {
                  maybeSingle: async () => ({
                    data: state.webhookEvents.get(eventId) ?? null,
                    error: null,
                  }),
                };
              },
            };
          },
          update(values: Record<string, unknown>) {
            return {
              eq(_column: string, eventId: string) {
                const existing = state.webhookEvents.get(eventId) ?? {};
                state.webhookEvents.set(eventId, { ...existing, ...values });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === "properties") {
        return {
          select() {
            return {
              eq(_column: string, listingId: string) {
                return {
                  maybeSingle: async () => ({
                    data: listingId === propertiesRow.id ? propertiesRow : null,
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "listing_payments") {
        const chain = {
          filters: {} as Record<string, unknown>,
          eq(column: string, value: unknown) {
            this.filters[column] = value;
            return this;
          },
          maybeSingle: async () => {
            const record = state.listingPayments.find((row) =>
              Object.entries(chain.filters).every(([key, value]) => row[key] === value)
            );
            return { data: record ?? null, error: null };
          },
        };
        return {
          select() {
            chain.filters = {};
            return chain;
          },
          insert: async (payload: Record<string, unknown>) => {
            const duplicate = state.listingPayments.some(
              (row) =>
                row.idempotency_key === payload.idempotency_key ||
                (row.provider === payload.provider && row.provider_ref === payload.provider_ref)
            );
            if (duplicate) {
              return { error: { code: "23505", message: "duplicate payment" } };
            }
            state.listingPayments.push(payload);
            return { error: null };
          },
        };
      }

      if (table === "canada_listing_payg_entitlements") {
        const chain = {
          filters: {} as Record<string, unknown>,
          eq(column: string, value: unknown) {
            this.filters[column] = value;
            return this;
          },
          maybeSingle: async () => {
            const record = state.entitlements.find((row) =>
              Object.entries(chain.filters).every(([key, value]) => row[key] === value)
            );
            return { data: record ?? null, error: null };
          },
          order: async () => ({
            data: state.entitlements.filter((row) =>
              Object.entries(chain.filters).every(([key, value]) => row[key] === value)
            ),
            error: null,
          }),
        };
        return {
          select() {
            chain.filters = {};
            return chain;
          },
          insert: async (payload: Record<string, unknown>) => {
            const duplicate = state.entitlements.some(
              (row) =>
                row.idempotency_key === payload.idempotency_key ||
                (payload.stripe_event_id && row.stripe_event_id === payload.stripe_event_id) ||
                (payload.stripe_payment_intent_id &&
                  row.stripe_payment_intent_id === payload.stripe_payment_intent_id) ||
                (payload.stripe_checkout_session_id &&
                  row.stripe_checkout_session_id === payload.stripe_checkout_session_id) ||
                (row.listing_id === payload.listing_id && row.active === true && row.status === "granted")
            );
            if (duplicate) {
              return { error: { code: "23505", message: "duplicate entitlement" } };
            }
            state.entitlements.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

function buildDeps(options: {
  event: Stripe.Event;
  runtimeEnabled?: boolean;
  webhookEnabled?: boolean;
  paymentEnabled?: boolean;
  entitlementEnabled?: boolean;
}) {
  const state: WebhookHarnessState = {
    webhookEvents: new Map(),
    listingPayments: [],
    entitlements: [],
    processStripeEventCalls: 0,
  };
  const adminClient = createAdminClient(state);

  const deps: BillingStripeWebhookRouteDeps = {
    hasServiceRoleEnv: () => true,
    getProviderModes: async () => ({ stripeMode: "test" }),
    getStripeConfigForMode: () => ({
      mode: "test",
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    }),
    constructStripeEvent: () => options.event,
    createServiceRoleClient: () => adminClient as never,
    getStripeClient: () => ({}) as never,
    processStripeEvent: async () => {
      state.processStripeEventCalls += 1;
      return {
        status: "processed",
        reason: null,
        profileId: "profile-1",
        planTier: "tenant_pro",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        priceId: "price_1",
        applied: true,
      };
    },
    getCanadaRentalPaygRuntimeEnabled: async () => options.runtimeEnabled ?? false,
    getCanadaRentalPaygWebhookFulfilmentEnabled: async () => options.webhookEnabled ?? false,
    getCanadaRentalPaygPaymentPersistenceEnabled: async () => options.paymentEnabled ?? false,
    getCanadaRentalPaygEntitlementGrantEnabled: async () => options.entitlementEnabled ?? false,
    validateCanadaRentalPaygWebhookContract,
    buildCanadaRentalPaygPaymentPersistenceContract,
    buildCanadaRentalPaygEntitlementGrantContract,
    executeCanadaRentalPaygFulfilmentPayloads,
    logFailure: () => undefined,
    logOperationalEvent: () => undefined,
    logStripeWebhookApplied: () => undefined,
  };

  return { deps, state };
}

function makeRequest() {
  return new Request("http://localhost/api/billing/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "stubbed" },
    body: "{}",
  });
}

void test("Canada webhook cannot mutate when the fulfilment gates are off", async () => {
  const { deps, state } = buildDeps({
    event: buildCanadaCheckoutCompletedEvent(),
    runtimeEnabled: true,
    webhookEnabled: false,
    paymentEnabled: false,
    entitlementEnabled: false,
  });

  const response = await postBillingStripeWebhookResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  assert.equal(state.listingPayments.length, 0);
  assert.equal(state.entitlements.length, 0);
  assert.equal(state.processStripeEventCalls, 0);
});

void test("Canada webhook inserts payment and entitlement when all mutation gates are on", async () => {
  const { deps, state } = buildDeps({
    event: buildCanadaCheckoutCompletedEvent(),
    runtimeEnabled: true,
    webhookEnabled: true,
    paymentEnabled: true,
    entitlementEnabled: true,
  });

  const response = await postBillingStripeWebhookResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  assert.equal(state.listingPayments.length, 1);
  assert.equal(state.entitlements.length, 1);
  assert.equal(state.listingPayments[0]?.provider, "stripe");
  assert.equal(state.listingPayments[0]?.provider_ref, "pi_ca_live_1");
  assert.equal(state.listingPayments[0]?.status, "paid");
  assert.equal(state.entitlements[0]?.status, "granted");
  assert.equal(state.entitlements[0]?.active, true);
  assert.equal(state.processStripeEventCalls, 0);
});

void test("Canada webhook replay is a no-op success after the event has already been processed", async () => {
  const event = buildCanadaCheckoutCompletedEvent();
  const { deps, state } = buildDeps({
    event,
    runtimeEnabled: true,
    webhookEnabled: true,
    paymentEnabled: true,
    entitlementEnabled: true,
  });

  const first = await postBillingStripeWebhookResponse(makeRequest(), deps);
  assert.equal(first.status, 200);
  assert.equal(state.listingPayments.length, 1);
  assert.equal(state.entitlements.length, 1);

  const second = await postBillingStripeWebhookResponse(makeRequest(), deps);
  assert.equal(second.status, 200);
  assert.equal(state.listingPayments.length, 1);
  assert.equal(state.entitlements.length, 1);
});

void test("subscription checkout webhook handling remains on the existing processor path", async () => {
  const { deps, state } = buildDeps({
    event: buildSubscriptionCheckoutCompletedEvent(),
    runtimeEnabled: true,
    webhookEnabled: true,
    paymentEnabled: true,
    entitlementEnabled: true,
  });

  const response = await postBillingStripeWebhookResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  assert.equal(state.processStripeEventCalls, 1);
  assert.equal(state.listingPayments.length, 0);
  assert.equal(state.entitlements.length, 0);
});
