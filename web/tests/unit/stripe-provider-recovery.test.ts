import test from "node:test";
import assert from "node:assert/strict";

import { restoreStripeProviderBilling } from "../../lib/billing/stripe-provider-recovery";

const originalTenantMonthlyPriceEnv = process.env.STRIPE_PRICE_TENANT_MONTHLY;

test.after(() => {
  if (originalTenantMonthlyPriceEnv === undefined) {
    delete process.env.STRIPE_PRICE_TENANT_MONTHLY;
    return;
  }

  process.env.STRIPE_PRICE_TENANT_MONTHLY = originalTenantMonthlyPriceEnv;
});

type QueryResult = { data: unknown; error: { message?: string } | null };

function createAdminClient(options: {
  existingPlan: Record<string, unknown> | null;
  fallbackSubscriptionId?: string | null;
  onPlanUpsert?: (values: Record<string, unknown>) => void;
}) {
  const existingPlan = options.existingPlan;
  const fallbackSubscriptionId = options.fallbackSubscriptionId ?? null;

  return {
    from(table: string) {
      if (table === "profile_plans") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async (): Promise<QueryResult> => ({
                    data: existingPlan,
                    error: null,
                  }),
                };
              },
            };
          },
          upsert: async (values: Record<string, unknown>) => {
            options.onPlanUpsert?.(values);
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
                          limit: async () => ({
                            data: fallbackSubscriptionId
                              ? [{ provider_subscription_id: fallbackSubscriptionId }]
                              : [],
                            error: null,
                          }),
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

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

void test("restoreStripeProviderBilling clears manual override and restores stripe-owned state", async () => {
  process.env.STRIPE_PRICE_TENANT_MONTHLY = "price_tenant_monthly";
  let upsertedPlan: Record<string, unknown> | null = null;
  let issuedCredits = false;

  const result = await restoreStripeProviderBilling({
    adminClient: createAdminClient({
      existingPlan: {
        billing_source: "manual",
        plan_tier: "free",
        valid_until: "2099-01-01T00:00:00.000Z",
        stripe_subscription_id: "sub_live_123",
      },
      onPlanUpsert(values) {
        upsertedPlan = values;
      },
    }) as never,
    stripe: {
      subscriptions: {
        retrieve: async () =>
          ({
            id: "sub_live_123",
            status: "active",
            customer: "cus_live_123",
            current_period_start: 1_800_000_000,
            current_period_end: 1_802_678_400,
            canceled_at: null,
            items: {
              data: [{ price: { id: "price_tenant_monthly" } }],
            },
          }) as never,
      },
    },
    profileId: "11111111-1111-4111-8111-111111111111",
    actorId: "22222222-2222-4222-8222-222222222222",
    upsertSubscriptionRecordFn: async () => ({ id: "subscription-row" } as never),
    issueSubscriptionCreditsIfNeededFn: async () => {
      issuedCredits = true;
      return { issued: true };
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.billingSource, "stripe");
  assert.equal(result.planTier, "tenant_pro");
  assert.equal(result.stripeSubscriptionId, "sub_live_123");
  assert.equal(result.stripePriceId, "price_tenant_monthly");
  assert.equal(result.usedFallbackSubscriptionId, false);
  assert.equal(upsertedPlan?.billing_source, "stripe");
  assert.equal(upsertedPlan?.plan_tier, "tenant_pro");
  assert.equal(upsertedPlan?.max_listings_override, null);
  assert.equal(upsertedPlan?.stripe_subscription_id, "sub_live_123");
  assert.equal(upsertedPlan?.stripe_price_id, "price_tenant_monthly");
  assert.equal(issuedCredits, true);
});

void test("restoreStripeProviderBilling can recover using subscriptions-table fallback id", async () => {
  process.env.STRIPE_PRICE_TENANT_MONTHLY = "price_tenant_monthly";
  const result = await restoreStripeProviderBilling({
    adminClient: createAdminClient({
      existingPlan: {
        billing_source: "manual",
        plan_tier: "free",
        valid_until: null,
        stripe_subscription_id: null,
      },
      fallbackSubscriptionId: "sub_fallback_123",
    }) as never,
    stripe: {
      subscriptions: {
        retrieve: async (subscriptionId) =>
          ({
            id: subscriptionId,
            status: "active",
            customer: "cus_live_456",
            current_period_start: 1_800_000_000,
            current_period_end: 1_802_678_400,
            canceled_at: null,
            items: {
              data: [{ price: { id: "price_tenant_monthly" } }],
            },
          }) as never,
      },
    },
    profileId: "11111111-1111-4111-8111-111111111111",
    actorId: "22222222-2222-4222-8222-222222222222",
    upsertSubscriptionRecordFn: async () => null,
    issueSubscriptionCreditsIfNeededFn: async () => ({ issued: false }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.usedFallbackSubscriptionId, true);
  assert.equal(result.stripeSubscriptionId, "sub_fallback_123");
});

void test("restoreStripeProviderBilling rejects accounts that are not manual overrides", async () => {
  process.env.STRIPE_PRICE_TENANT_MONTHLY = "price_tenant_monthly";
  const result = await restoreStripeProviderBilling({
    adminClient: createAdminClient({
      existingPlan: {
        billing_source: "stripe",
        plan_tier: "tenant_pro",
        valid_until: "2099-01-01T00:00:00.000Z",
      },
    }) as never,
    stripe: {
      subscriptions: {
        retrieve: async () => {
          throw new Error("should not run");
        },
      },
    },
    profileId: "11111111-1111-4111-8111-111111111111",
    actorId: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_manual_override");
});
