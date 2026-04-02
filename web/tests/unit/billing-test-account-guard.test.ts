import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateBillingTestability,
  isDesignatedBillingTestAccountEmail,
} from "../../lib/billing/billing-test-accounts";

void test("designated billing test accounts allow internal .test domains and explicit allowlist emails", () => {
  assert.equal(isDesignatedBillingTestAccountEmail("smoke@propatyhub.test"), true);
  assert.equal(isDesignatedBillingTestAccountEmail("qa@rentnow.test"), true);
  assert.equal(
    isDesignatedBillingTestAccountEmail("ops@example.com", {
      allowlistedEmails: new Set(["ops@example.com"]),
    }),
    true
  );
  assert.equal(isDesignatedBillingTestAccountEmail("real-user@gmail.com"), false);
});

void test("billing testability blocks reset when an active provider subscription still exists", () => {
  const state = evaluateBillingTestability({
    email: "smoke@propatyhub.test",
    snapshot: {
      effectivePlanTier: "free",
      billingSource: "manual",
      validUntil: "2026-04-01T00:00:00.000Z",
    },
    subscriptionRows: [
      {
        provider: "stripe",
        provider_subscription_id: "sub_live_123",
        status: "active",
        current_period_end: "2026-05-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(state.isDesignatedTestAccount, true);
  assert.equal(state.canReset, false);
  assert.equal(state.status, "blocked_active_subscription");
  assert.equal(state.blocker?.providerSubscriptionId, "sub_live_123");
});

void test("billing testability marks an expired free baseline as reusable now", () => {
  const state = evaluateBillingTestability({
    email: "smoke@propatyhub.test",
    snapshot: {
      effectivePlanTier: "free",
      billingSource: "manual",
      validUntil: "2026-04-01T00:00:00.000Z",
      stripeCustomerIdPresent: false,
      stripeSubscriptionIdPresent: false,
      stripePriceIdPresent: false,
      stripeStatus: null,
    },
    subscriptionRows: [],
  });

  assert.equal(state.isDesignatedTestAccount, true);
  assert.equal(state.canReset, true);
  assert.equal(state.reusableNow, true);
  assert.equal(state.status, "ready_now");
});
