import test from "node:test";
import assert from "node:assert/strict";

import {
  computeProviderPlanUpdate,
  isProviderEventProcessed,
  resolveTierForRole,
} from "../../lib/billing/provider-payments";

void test("provider event is processed when verified with timestamp", () => {
  assert.equal(
    isProviderEventProcessed({ status: "verified", processed_at: "2024-01-01T00:00:00.000Z" }),
    true
  );
});

void test("provider event is processed when skipped with timestamp", () => {
  assert.equal(
    isProviderEventProcessed({ status: "skipped", processed_at: "2024-01-01T00:00:00.000Z" }),
    true
  );
});

void test("provider event is not processed without timestamp", () => {
  assert.equal(isProviderEventProcessed({ status: "verified", processed_at: null }), false);
});

void test("provider event is not processed for failed status", () => {
  assert.equal(
    isProviderEventProcessed({ status: "failed", processed_at: "2024-01-01T00:00:00.000Z" }),
    false
  );
});

void test("manual billing override skips provider plan updates", () => {
  const decision = computeProviderPlanUpdate("pro", "2024-02-01T00:00:00.000Z", {
    billing_source: "manual",
    plan_tier: "starter",
    valid_until: "2024-03-01T00:00:00.000Z",
  });

  assert.equal(decision.skipped, true);
  assert.equal(decision.planTier, "starter");
  assert.equal(decision.validUntil, "2024-03-01T00:00:00.000Z");
  assert.equal(decision.skipReason, "manual_override");
});

void test("provider plan update applies when no manual override", () => {
  const decision = computeProviderPlanUpdate("tenant_pro", "2024-02-01T00:00:00.000Z", {
    billing_source: "stripe",
    plan_tier: "starter",
    valid_until: null,
  });

  assert.equal(decision.skipped, false);
  assert.equal(decision.planTier, "tenant_pro");
  assert.equal(decision.validUntil, "2024-02-01T00:00:00.000Z");
});

void test("resolveTierForRole restricts tiers by role", () => {
  assert.equal(resolveTierForRole("tenant", "tenant_pro"), "tenant_pro");
  assert.equal(resolveTierForRole("tenant", "pro"), null);
  assert.equal(resolveTierForRole("landlord", "starter"), "starter");
  assert.equal(resolveTierForRole("agent", "pro"), "pro");
});
