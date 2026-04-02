import test from "node:test";
import assert from "node:assert/strict";

import { resetBillingTestAccount } from "../../lib/billing/billing-test-account-reset";

type Store = {
  authEmail: string | null;
  plan: Record<string, unknown> | null;
  subscriptions: Record<string, unknown>[];
  billingNotes: string | null;
  upsertedPlan: Record<string, unknown> | null;
};

function createAdminClient(store: Store) {
  return {
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: store.authEmail ? { email: store.authEmail } : null,
          },
          error: null,
        }),
      },
    },
    from(table: string) {
      if (table === "profile_plans") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: store.plan, error: null }),
                };
              },
            };
          },
          upsert: async (values: Record<string, unknown>) => {
            store.upsertedPlan = values;
            store.plan = values;
            return { error: null };
          },
        };
      }

      if (table === "subscriptions") {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return {
                      order() {
                        return {
                          limit: async () => ({ data: store.subscriptions, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
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
            store.billingNotes = typeof values.billing_notes === "string" ? values.billing_notes : null;
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

void test("billing test-account reset is denied for non-designated live accounts", async () => {
  const store: Store = {
    authEmail: "real-user@gmail.com",
    plan: {
      billing_source: "manual",
      plan_tier: "pro",
    },
    subscriptions: [],
    billingNotes: null,
    upsertedPlan: null,
  };

  const result = await resetBillingTestAccount({
    adminClient: createAdminClient(store) as never,
    profileId: "11111111-1111-4111-8111-111111111111",
    actorId: "admin-1",
    reason: "prepare reuse",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_designated_test_account");
  assert.equal(store.upsertedPlan, null);
  assert.match(store.billingNotes ?? "", /Billing test-account reset denied/);
});

void test("billing test-account reset is blocked when active provider state still exists", async () => {
  const store: Store = {
    authEmail: "smoke@propatyhub.test",
    plan: {
      billing_source: "stripe",
      plan_tier: "pro",
      stripe_subscription_id: "sub_live_123",
    },
    subscriptions: [
      {
        provider: "stripe",
        provider_subscription_id: "sub_live_123",
        status: "active",
        current_period_end: "2026-05-01T00:00:00.000Z",
      },
    ],
    billingNotes: null,
    upsertedPlan: null,
  };

  const result = await resetBillingTestAccount({
    adminClient: createAdminClient(store) as never,
    profileId: "22222222-2222-4222-8222-222222222222",
    actorId: "admin-1",
    reason: "prepare reuse",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "active_provider_subscription");
  assert.equal(result.blockerSubscriptionId, "sub_live_123");
  assert.equal(store.upsertedPlan, null);
  assert.match(store.billingNotes ?? "", /Billing test-account reset blocked/);
});

void test("billing test-account reset clears current plan state but preserves history rows", async () => {
  const store: Store = {
    authEmail: "smoke@propatyhub.test",
    plan: {
      billing_source: "manual",
      plan_tier: "tenant_pro",
      valid_until: "2026-06-01T00:00:00.000Z",
      stripe_customer_id: "cus_live_123",
      stripe_subscription_id: "sub_live_123",
      stripe_price_id: "price_live_123",
      stripe_status: "active",
      stripe_current_period_end: "2026-06-01T00:00:00.000Z",
    },
    subscriptions: [
      {
        provider: "stripe",
        provider_subscription_id: "sub_old_canceled",
        status: "canceled",
        current_period_end: "2026-03-01T00:00:00.000Z",
      },
    ],
    billingNotes: null,
    upsertedPlan: null,
  };

  const result = await resetBillingTestAccount({
    adminClient: createAdminClient(store) as never,
    profileId: "33333333-3333-4333-8333-333333333333",
    actorId: "admin-1",
    reason: "prepare next smoke",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reusableNow, true);
  assert.equal(store.upsertedPlan?.billing_source, "manual");
  assert.equal(store.upsertedPlan?.plan_tier, "free");
  assert.equal(store.upsertedPlan?.max_listings_override, null);
  assert.equal(store.upsertedPlan?.stripe_customer_id, null);
  assert.equal(store.upsertedPlan?.stripe_subscription_id, null);
  assert.equal(store.upsertedPlan?.stripe_price_id, null);
  assert.equal(store.upsertedPlan?.stripe_status, null);
  assert.match(String(store.upsertedPlan?.valid_until || ""), /\d{4}-\d{2}-\d{2}T/);
  assert.equal(store.subscriptions.length, 1);
  assert.match(store.billingNotes ?? "", /Billing test-account reset applied/);
  assert.match(store.billingNotes ?? "", /Historical subscriptions and webhook events were preserved/);
});
