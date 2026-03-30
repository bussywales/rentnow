import test from "node:test";
import assert from "node:assert/strict";

import {
  SUBSCRIPTION_PLAN_CARDS,
  getSubscriptionPlanCardKeyForRole,
} from "@/lib/billing/subscription-plan-cards";

void test("subscription plan cards keep role-to-card mapping stable", () => {
  const landlord = SUBSCRIPTION_PLAN_CARDS.find((card) => card.key === "landlord-pro");
  const agent = SUBSCRIPTION_PLAN_CARDS.find((card) => card.key === "agent-pro");
  const tenant = SUBSCRIPTION_PLAN_CARDS.find((card) => card.key === "tenant-pro");

  assert.equal(landlord?.role, "landlord");
  assert.equal(agent?.role, "agent");
  assert.equal(tenant?.role, "tenant");
  assert.equal(landlord?.tier, "pro");
  assert.equal(agent?.tier, "pro");
  assert.equal(tenant?.tier, "tenant_pro");
});

void test("role lookup returns the correct billing plan card key", () => {
  assert.equal(getSubscriptionPlanCardKeyForRole("landlord"), "landlord-pro");
  assert.equal(getSubscriptionPlanCardKeyForRole("agent"), "agent-pro");
  assert.equal(getSubscriptionPlanCardKeyForRole("tenant"), "tenant-pro");
  assert.equal(getSubscriptionPlanCardKeyForRole("admin"), null);
  assert.equal(getSubscriptionPlanCardKeyForRole(null), null);
});
