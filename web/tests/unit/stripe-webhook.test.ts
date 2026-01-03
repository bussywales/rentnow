import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

import {
  constructStripeEvent,
  extractPlanMetadata,
  requireCheckoutMetadata,
  resolvePlanFromStripe,
} from "../../lib/billing/stripe-webhook";
import { computeStripePlanUpdate } from "../../lib/billing/stripe-plan-update";
import { parseWebhookInsertError } from "../../lib/billing/stripe-webhook-events";

process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.STRIPE_PRICE_LANDLORD_STARTER_MONTHLY = "price_landlord_starter_monthly";

void test("constructStripeEvent verifies signature", () => {
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test" } },
  });

  const stripe = new Stripe("sk_test_123", { apiVersion: "2024-06-20" });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_test",
  });

  const event = constructStripeEvent(payload, signature);
  assert.equal(event.type, "checkout.session.completed");
});

void test("extractPlanMetadata prefers plan_tier and user_id", () => {
  const metadata = {
    user_id: "user_123",
    plan_tier: "pro",
    role: "landlord",
    cadence: "monthly",
  };

  const parsed = extractPlanMetadata(metadata);
  assert.equal(parsed.profileId, "user_123");
  assert.equal(parsed.tier, "pro");
  assert.equal(parsed.role, "landlord");
  assert.equal(parsed.cadence, "monthly");
});

void test("resolvePlanFromStripe prefers price mapping over metadata", () => {
  const subscription = {
    items: {
      data: [
        {
          price: { id: "price_landlord_starter_monthly" },
        },
      ],
    },
    metadata: {
      plan_tier: "pro",
      user_id: "user_456",
    },
  } as Stripe.Subscription;

  const plan = resolvePlanFromStripe(subscription, null);
  assert.equal(plan.tier, "starter");
  assert.equal(plan.priceId, "price_landlord_starter_monthly");
});

void test("resolvePlanFromStripe returns null tier when price is unmapped", () => {
  const subscription = {
    items: {
      data: [
        {
          price: { id: "price_unknown" },
        },
      ],
    },
    metadata: {
      plan_tier: "starter",
      user_id: "user_789",
    },
  } as Stripe.Subscription;

  const plan = resolvePlanFromStripe(subscription, null);
  assert.equal(plan.tier, null);
});

void test("parseWebhookInsertError treats duplicate event ids as idempotent", () => {
  const result = parseWebhookInsertError({ code: "23505" });
  assert.equal(result.duplicate, true);
  assert.equal(result.error, null);
});

void test("requireCheckoutMetadata flags missing user_id or plan_tier", () => {
  const result = requireCheckoutMetadata({});
  assert.equal(result.ok, false);
  assert.equal(result.profileId, null);
  assert.equal(result.tier, null);
});

void test("computeStripePlanUpdate downgrades canceled unless manual", () => {
  const canceled = computeStripePlanUpdate(
    {
      tier: "pro",
      status: "canceled",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    },
    null
  );
  assert.equal(canceled.planTier, "free");
  assert.equal(canceled.validUntil, null);
  assert.equal(canceled.skipped, false);

  const manual = computeStripePlanUpdate(
    {
      tier: "pro",
      status: "canceled",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    },
    { billing_source: "manual", plan_tier: "pro", valid_until: "2099-02-01T00:00:00.000Z" }
  );
  assert.equal(manual.skipped, true);
  assert.equal(manual.planTier, "pro");
});
