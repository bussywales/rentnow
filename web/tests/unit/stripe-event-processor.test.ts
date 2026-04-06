import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";

import { processStripeEvent } from "../../lib/billing/stripe-event-processor";

const originalTenantMonthlyPriceEnv = process.env.STRIPE_PRICE_TENANT_MONTHLY;

test.before(() => {
  process.env.STRIPE_PRICE_TENANT_MONTHLY = "price_tenant_monthly";
});

test.after(() => {
  if (originalTenantMonthlyPriceEnv === undefined) {
    delete process.env.STRIPE_PRICE_TENANT_MONTHLY;
    return;
  }

  process.env.STRIPE_PRICE_TENANT_MONTHLY = originalTenantMonthlyPriceEnv;
});

function createAdminClient(state: {
  existingPlan: Record<string, unknown> | null;
  billingNotes?: string | null;
  role?: string | null;
}) {
  const store = {
    existingPlan: state.existingPlan,
    billingNotes: state.billingNotes ?? null,
    upsertedPlan: null as Record<string, unknown> | null,
    upsertedBillingNotes: null as Record<string, unknown> | null,
    analyticsEvents: [] as Record<string, unknown>[],
  };

  const client = {
    __store: store,
    from(table: string) {
      if (table === "profile_plans") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: store.existingPlan,
                    error: null,
                  }),
                };
              },
            };
          },
          upsert: async (values: Record<string, unknown>) => {
            store.upsertedPlan = values;
            store.existingPlan = { ...(store.existingPlan ?? {}), ...values };
            return { error: null };
          },
        };
      }

      if (table === "profile_billing_notes") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: store.billingNotes !== null ? { billing_notes: store.billingNotes } : null,
                    error: null,
                  }),
                };
              },
            };
          },
          upsert: async (values: Record<string, unknown>) => {
            store.upsertedBillingNotes = values;
            store.billingNotes = typeof values.billing_notes === "string" ? values.billing_notes : null;
            return { error: null };
          },
        };
      }

      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { role: state.role ?? "tenant" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "subscriptions") {
        return {
          upsert() {
            return {
              select() {
                return {
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: "skip subscription row write in unit test" },
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "product_analytics_events") {
        return {
          insert: async (values: Record<string, unknown>) => {
            store.analyticsEvents.push(values);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return client;
}

function createCheckoutCompletedEvent(profileId: string): Stripe.Event {
  return {
    id: "evt_auto_takeover_123",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        mode: "subscription",
        subscription: "sub_live_123",
        metadata: {
          profile_id: profileId,
          plan_tier: "tenant_pro",
        },
      },
    },
  } as unknown as Stripe.Event;
}

function createStripeSubscription(): Stripe.Subscription {
  return {
    id: "sub_live_123",
    object: "subscription",
    status: "active",
    customer: "cus_live_123",
    current_period_start: 1_800_000_000,
    current_period_end: 1_802_678_400,
    canceled_at: null,
    metadata: {},
    items: {
      object: "list",
      data: [
        {
          id: "si_test_123",
          object: "subscription_item",
          price: {
            id: "price_tenant_monthly",
            object: "price",
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

void test("active manual override still blocks Stripe takeover during webhook processing", async () => {
  const adminClient = createAdminClient({
    existingPlan: {
      billing_source: "manual",
      plan_tier: "free",
      valid_until: "2099-01-01T00:00:00.000Z",
    },
  });

  const result = await processStripeEvent(
    {
      adminClient: adminClient as never,
      stripe: {
        subscriptions: {
          retrieve: async () => createStripeSubscription(),
        },
      } as never,
      route: "/api/billing/stripe/webhook",
      startTime: Date.now(),
    },
    createCheckoutCompletedEvent("11111111-1111-4111-8111-111111111111")
  );

  assert.equal(result.status, "ignored");
  assert.equal(result.reason, "manual_override");
  assert.equal(adminClient.__store.upsertedPlan, null);
  assert.equal(adminClient.__store.upsertedBillingNotes, null);
  assert.equal(adminClient.__store.analyticsEvents.length, 1);
  assert.equal(adminClient.__store.analyticsEvents[0]?.event_name, "checkout_succeeded");
  assert.equal(adminClient.__store.analyticsEvents[0]?.billing_source, "manual");
  assert.equal(adminClient.__store.analyticsEvents[0]?.provider_subscription_id, "sub_live_123");
  assert.equal(
    (adminClient.__store.analyticsEvents[0]?.properties as { sourceEventId?: string } | undefined)
      ?.sourceEventId,
    "evt_auto_takeover_123"
  );
});

void test("expired manual override allows Stripe takeover and appends audit note", async () => {
  const adminClient = createAdminClient({
    existingPlan: {
      billing_source: "manual",
      plan_tier: "free",
      valid_until: "2026-01-01T00:00:00.000Z",
    },
    billingNotes: "[2026-03-01T00:00:00.000Z] Support action: set_plan_tier. Reason: temporary override",
  });

  const result = await processStripeEvent(
    {
      adminClient: adminClient as never,
      stripe: {
        subscriptions: {
          retrieve: async () => createStripeSubscription(),
        },
      } as never,
      route: "/api/billing/stripe/webhook",
      startTime: Date.now(),
    },
    createCheckoutCompletedEvent("11111111-1111-4111-8111-111111111111")
  );

  assert.equal(result.status, "processed");
  assert.equal(result.reason, null);
  assert.equal(result.profileId, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.planTier, "tenant_pro");
  assert.equal(result.applied, true);
  assert.equal(adminClient.__store.upsertedPlan?.billing_source, "stripe");
  assert.equal(adminClient.__store.upsertedPlan?.plan_tier, "tenant_pro");
  assert.equal(adminClient.__store.upsertedPlan?.stripe_subscription_id, "sub_live_123");
  assert.equal(adminClient.__store.upsertedPlan?.stripe_price_id, "price_tenant_monthly");
  assert.match(adminClient.__store.billingNotes ?? "", /Automatic Stripe takeover after expired manual override/);
  assert.match(adminClient.__store.billingNotes ?? "", /source_event=evt_auto_takeover_123/);
  assert.match(adminClient.__store.billingNotes ?? "", /stripe_subscription_id=sub_live_123/);
  assert.equal(adminClient.__store.analyticsEvents.length, 1);
  assert.equal(adminClient.__store.analyticsEvents[0]?.event_name, "checkout_succeeded");
  assert.equal(adminClient.__store.analyticsEvents[0]?.provider_subscription_id, "sub_live_123");
  assert.equal(
    (adminClient.__store.analyticsEvents[0]?.properties as { sourceEventId?: string } | undefined)
      ?.sourceEventId,
    "evt_auto_takeover_123"
  );
});

void test("admin replay does not emit duplicate checkout success analytics", async () => {
  const adminClient = createAdminClient({
    existingPlan: {
      billing_source: "stripe",
      plan_tier: "tenant_pro",
      valid_until: "2027-02-15T08:00:00.000Z",
      stripe_subscription_id: "sub_live_123",
      stripe_status: "active",
      stripe_price_id: "price_tenant_monthly",
      stripe_current_period_end: "2027-02-15T08:00:00.000Z",
    },
  });

  const result = await processStripeEvent(
    {
      adminClient: adminClient as never,
      stripe: {
        subscriptions: {
          retrieve: async () => createStripeSubscription(),
        },
      } as never,
      route: "/api/admin/billing/stripe/replay",
      startTime: Date.now(),
    },
    createCheckoutCompletedEvent("11111111-1111-4111-8111-111111111111")
  );

  assert.equal(result.status, "ignored");
  assert.equal(result.reason, "duplicate_update");
  assert.equal(adminClient.__store.analyticsEvents.length, 0);
});
