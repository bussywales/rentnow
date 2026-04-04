import test from "node:test";
import assert from "node:assert/strict";

import { resolveSubscriptionLifecycleState } from "../../lib/billing/subscription-lifecycle";
import {
  buildHostActivationState,
  listMissingHostProfileFields,
} from "../../lib/host/activation";
import { getPlanForTier } from "../../lib/plans";

void test("host activation prioritizes profile completion when host contact fields are missing", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "active",
    stripeCurrentPeriodEnd: "2026-05-01T00:00:00.000Z",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
    },
    now: Date.parse("2026-04-04T00:00:00.000Z"),
  });

  const state = buildHostActivationState({
    role: "agent",
    billingSource: "stripe",
    lifecycle,
    plan: getPlanForTier("pro"),
    activeListings: 0,
    draftListings: 0,
    pendingListings: 0,
    liveListings: 0,
    rejectedListings: 0,
    changesRequestedListings: 0,
    hasFeaturedRequest: false,
    hasFeaturedListing: false,
    profileMissingFields: ["phone number", "preferred contact"],
  });

  assert.equal(state.planLabel, "Agent Pro");
  assert.equal(state.nextStep.label, "Complete profile");
  assert.match(state.nextStep.description, /phone number and preferred contact/);
  assert.ok(state.blockers.some((item) => item.includes("Profile still needs")));
});

void test("host activation drives users to create a first listing when paid but empty", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "active",
    stripeCurrentPeriodEnd: "2026-05-01T00:00:00.000Z",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
    },
    now: Date.parse("2026-04-04T00:00:00.000Z"),
  });

  const state = buildHostActivationState({
    role: "landlord",
    billingSource: "stripe",
    lifecycle,
    plan: getPlanForTier("pro"),
    activeListings: 0,
    draftListings: 0,
    pendingListings: 0,
    liveListings: 0,
    rejectedListings: 0,
    changesRequestedListings: 0,
    hasFeaturedRequest: false,
    hasFeaturedListing: false,
    profileMissingFields: [],
  });

  assert.equal(state.planLabel, "Landlord Pro");
  assert.equal(state.nextStep.label, "Create your first listing");
  assert.ok(state.unlocked.some((line) => line.includes("Featured placement requests")));
  assert.equal(state.metrics[0]?.label, "No listings yet");
});

void test("host activation calls out approval and resubmission work when listings are not live yet", () => {
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: "stripe",
    planTier: "pro",
    validUntil: "2026-05-01T00:00:00.000Z",
    stripeStatus: "active",
    stripeCurrentPeriodEnd: "2026-05-01T00:00:00.000Z",
    providerSubscription: {
      provider: "stripe",
      provider_subscription_id: "sub_live_123",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
    },
    now: Date.parse("2026-04-04T00:00:00.000Z"),
  });

  const state = buildHostActivationState({
    role: "agent",
    billingSource: "stripe",
    lifecycle,
    plan: getPlanForTier("pro"),
    activeListings: 2,
    draftListings: 0,
    pendingListings: 1,
    liveListings: 0,
    rejectedListings: 1,
    changesRequestedListings: 1,
    hasFeaturedRequest: false,
    hasFeaturedListing: false,
    profileMissingFields: [],
  });

  assert.equal(state.nextStep.label, "Update listing and resubmit");
  assert.ok(state.blockers.some((item) => item.includes("rejected")));
  assert.ok(state.blockers.some((item) => item.includes("changes requested")));
  assert.deepEqual(
    state.metrics.map((metric) => metric.label),
    ["Awaiting review", "Changes requested", "Rejected"]
  );
});

void test("host profile completeness helper only flags missing contact fields", () => {
  assert.deepEqual(
    listMissingHostProfileFields({ phone: null, preferredContact: null }),
    ["phone number", "preferred contact"]
  );
  assert.deepEqual(
    listMissingHostProfileFields({ phone: "+440000000000", preferredContact: "email" }),
    []
  );
});
