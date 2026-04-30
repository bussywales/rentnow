import test from "node:test";
import assert from "node:assert/strict";

import { buildBillingSnapshot } from "../../lib/billing/snapshot";
import {
  buildBillingOpsDiagnostics,
  isReplayEligibleStripeEvent,
} from "../../lib/billing/admin-billing-diagnostics";

const ACTIVE_PERIOD_END = "2099-04-30T13:38:51.000Z";

void test("billing diagnostics surfaces manual override masking provider truth and ignored events", () => {
  const snapshot = buildBillingSnapshot({
    profileId: "11111111-1111-1111-1111-111111111111",
    email: "ops@example.com",
    role: "tenant",
    fullName: "Ops User",
    plan: {
      plan_tier: "free",
      billing_source: "manual",
      valid_until: "2026-04-30T23:59:59.999Z",
    },
    notes: {
      billing_notes:
        "[2026-03-31T12:00:00.000Z] Support action: set_plan_tier. Reason: temporary override",
    },
  });

  const diagnostics = buildBillingOpsDiagnostics({
    snapshot,
    plan: {
      plan_tier: "free",
      billing_source: "manual",
      valid_until: "2026-04-30T23:59:59.999Z",
      updated_at: "2026-03-31T12:00:00.000Z",
    },
    subscriptionRows: [
      {
        provider: "stripe",
        provider_subscription_id: "sub_live_123",
        status: "active",
        plan_tier: "tenant_pro",
        current_period_end: "2026-04-30T13:38:51.000Z",
        updated_at: "2026-03-31T12:30:00.000Z",
      },
    ],
    events: [
      {
        event_id: "evt_live_123",
        event_type: "checkout.session.completed",
        created_at: "2026-03-31T12:31:00.000Z",
        status: "ignored",
        reason: "manual_override",
        replay_count: 1,
        last_replay_at: "2026-03-31T12:32:00.000Z",
        last_replay_status: "ignored",
        last_replay_reason: "manual_override",
      },
    ],
    billingNotes: "[2026-03-31T12:00:00.000Z] Support action: set_plan_tier. Reason: temporary override",
  });

  assert.equal(diagnostics.hasStoredStripeTruth, true);
  assert.equal(diagnostics.manualOverrideMasksProviderTruth, true);
  assert.equal(diagnostics.stateMatchesProviderTruth, false);
  assert.equal(diagnostics.ignoredEventCount, 1);
  assert.equal(diagnostics.replayEligibleEventCount, 1);
  assert.equal(
    diagnostics.diagnostics.some((item) => item.key === "manual-override-masks-provider"),
    true
  );
  assert.equal(diagnostics.timeline.some((item) => item.title === "Stripe replay attempt"), true);
});

void test("billing diagnostics reports healthy state when app and provider truth align", () => {
  const snapshot = buildBillingSnapshot({
    profileId: "11111111-1111-1111-1111-111111111111",
    email: "ops@example.com",
    role: "tenant",
    fullName: "Ops User",
    plan: {
      plan_tier: "tenant_pro",
      billing_source: "stripe",
      stripe_subscription_id: "sub_live_123",
      stripe_customer_id: "cus_live_123",
      stripe_price_id: "price_live_123",
      stripe_status: "active",
      valid_until: ACTIVE_PERIOD_END,
    },
    notes: null,
  });

  const diagnostics = buildBillingOpsDiagnostics({
    snapshot,
    plan: {
      plan_tier: "tenant_pro",
      billing_source: "stripe",
      stripe_subscription_id: "sub_live_123",
      stripe_customer_id: "cus_live_123",
      stripe_price_id: "price_live_123",
      stripe_status: "active",
      valid_until: ACTIVE_PERIOD_END,
    },
    subscriptionRows: [
      {
        provider: "stripe",
        provider_subscription_id: "sub_live_123",
        status: "active",
        plan_tier: "tenant_pro",
        current_period_end: ACTIVE_PERIOD_END,
      },
    ],
    events: [
      {
        event_id: "evt_live_123",
        status: "processed",
        event_type: "checkout.session.completed",
      },
    ],
    billingNotes: null,
  });

  assert.equal(diagnostics.stateMatchesProviderTruth, true);
  assert.equal(diagnostics.replayEligibleEventCount, 0);
  assert.equal(diagnostics.diagnostics[0]?.key, "healthy");
  assert.equal(isReplayEligibleStripeEvent({ status: "processed" }), false);
});
