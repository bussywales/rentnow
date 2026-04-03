import test from "node:test";
import assert from "node:assert/strict";

import { resolveSubscriptionLifecycleState } from "../../lib/billing/subscription-lifecycle";

void test("subscription lifecycle reports active manual override separately from free baseline", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "manual",
    planTier: "pro",
    validUntil: "2099-06-01T00:00:00.000Z",
  });

  assert.equal(lifecycle.key, "manual_override");
  assert.equal(lifecycle.portalEligible, false);
});

void test("subscription lifecycle reports expired manual override as expired", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "manual",
    planTier: "pro",
    validUntil: "2026-01-01T00:00:00.000Z",
    now: Date.parse("2026-04-02T00:00:00.000Z"),
  });

  assert.equal(lifecycle.key, "expired");
});

void test("subscription lifecycle reports active Stripe subscription with renewal date", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "tenant_pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "active",
    stripeCurrentPeriodEnd: "2026-05-01T00:00:00.000Z",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
    },
    now: Date.parse("2026-04-02T00:00:00.000Z"),
  });

  assert.equal(lifecycle.key, "active_paid");
  assert.equal(lifecycle.renewalAt, "2026-05-01T00:00:00.000Z");
  assert.equal(lifecycle.portalEligible, true);
});

void test("subscription lifecycle reports cancellation at period end when Stripe cancellation is scheduled", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "active",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
      canceled_at: "2026-04-02T12:00:00.000Z",
    },
    now: Date.parse("2026-04-02T13:00:00.000Z"),
  });

  assert.equal(lifecycle.key, "cancelled_period_end");
  assert.equal(lifecycle.accessUntil, "2026-05-01T00:00:00.000Z");
  assert.equal(lifecycle.cancellationRequestedAt, "2026-04-02T12:00:00.000Z");
});

void test("subscription lifecycle reports Stripe payment issues distinctly", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "past_due",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "past_due",
      current_period_end: "2026-05-01T00:00:00.000Z",
    },
    now: Date.parse("2026-04-02T00:00:00.000Z"),
  });

  assert.equal(lifecycle.key, "payment_issue");
  assert.equal(lifecycle.portalEligible, true);
});
