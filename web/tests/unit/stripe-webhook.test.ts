import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

import { constructStripeEvent, extractPlanMetadata } from "../../lib/billing/stripe-webhook";

process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

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
