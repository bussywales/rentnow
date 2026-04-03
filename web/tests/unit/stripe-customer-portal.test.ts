import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStripeCustomerPortalReturnPath,
  evaluateStripeCustomerPortalAccess,
} from "../../lib/billing/stripe-customer-portal";

void test("stripe customer portal returns tenant users to tenant billing", () => {
  assert.equal(
    buildStripeCustomerPortalReturnPath("tenant"),
    "/tenant/billing?stripe=portal-return#plans"
  );
  assert.equal(
    buildStripeCustomerPortalReturnPath("agent"),
    "/dashboard/billing?stripe=portal-return#plans"
  );
});

void test("stripe customer portal only allows Stripe-backed lifecycle eligible accounts", () => {
  const allowed = evaluateStripeCustomerPortalAccess({
    plan: {
      billing_source: "stripe",
      plan_tier: "pro",
      valid_until: "2099-05-01T00:00:00.000Z",
      stripe_customer_id: "cus_live_123",
      stripe_subscription_id: "sub_live_123",
      stripe_status: "active",
      stripe_current_period_end: "2099-05-01T00:00:00.000Z",
    },
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2099-05-01T00:00:00.000Z",
    },
  });

  assert.equal(allowed.ok, true);

  const blocked = evaluateStripeCustomerPortalAccess({
    plan: {
      billing_source: "manual",
      plan_tier: "free",
      valid_until: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    },
  });

  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /Only Stripe-backed subscriptions/);
});

void test("stripe customer portal blocks expired Stripe rows", () => {
  const blocked = evaluateStripeCustomerPortalAccess({
    plan: {
      billing_source: "stripe",
      plan_tier: "tenant_pro",
      valid_until: "2026-01-01T00:00:00.000Z",
      stripe_customer_id: "cus_live_123",
      stripe_subscription_id: "sub_live_123",
      stripe_status: "canceled",
      stripe_current_period_end: "2026-01-01T00:00:00.000Z",
    },
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "canceled",
      current_period_end: "2026-01-01T00:00:00.000Z",
    },
  });

  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /Subscription management is only available/);
});
