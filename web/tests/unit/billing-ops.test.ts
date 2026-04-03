import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { maskEmail, maskIdentifier } from "../../lib/billing/mask";
import { buildBillingSnapshot } from "../../lib/billing/snapshot";
import { isAdminRole, validateUpgradeRequestAction } from "../../lib/billing/admin-validation";
import { buildSupportSnapshot } from "../../lib/billing/support-snapshot";
import { resolveEffectivePlanTier, resolveEffectiveTenantPlanTier } from "../../lib/plans";

void test("maskIdentifier hides long identifiers and keeps short values", () => {
  assert.equal(maskIdentifier(null), "—");
  assert.equal(maskIdentifier("short"), "short");
  assert.equal(maskIdentifier("cus_1234567890"), "cus_12...7890");
});

void test("maskEmail hides local part and keeps domain", () => {
  assert.equal(maskEmail(null), "—");
  assert.equal(maskEmail("a@propatyhub.com"), "a***@propatyhub.com");
  assert.equal(maskEmail("support@propatyhub.com"), "su***@propatyhub.com");
});

void test("buildBillingSnapshot normalizes plan and masks Stripe fields", () => {
  const snapshot = buildBillingSnapshot({
    profileId: "11111111-1111-1111-1111-111111111111",
    email: "ops@example.com",
    role: "landlord",
    fullName: "Ops User",
    plan: {
      plan_tier: "pro",
      billing_source: "stripe",
      stripe_customer_id: "cus_1234567890",
      stripe_subscription_id: "sub_1234567890",
      stripe_price_id: "price_1234567890",
      stripe_status: "active",
      valid_until: "2099-01-01T00:00:00.000Z",
    },
    notes: {
      billing_notes: "VIP account",
    },
  });

  assert.equal(snapshot.planTier, "pro");
  assert.equal(snapshot.effectivePlanTier, "pro");
  assert.equal(snapshot.billingSource, "stripe");
  assert.equal(snapshot.manualOverrideActive, false);
  assert.equal(snapshot.stripeCustomerIdPresent, true);
  assert.equal(snapshot.stripeSubscriptionIdPresent, true);
  assert.equal(snapshot.stripePriceIdPresent, true);
  assert.equal(snapshot.stripeCustomerId, "cus_12...7890");
  assert.equal(snapshot.stripeSubscriptionId, "sub_12...7890");
  assert.equal(snapshot.stripePriceId, "price_...7890");
  assert.equal(snapshot.billingNotes, "VIP account");
});

void test("expired tenant overrides resolve to free entitlements", () => {
  assert.equal(
    resolveEffectivePlanTier("tenant_pro", "2026-01-01T00:00:00.000Z", Date.parse("2026-03-18T00:00:00.000Z")),
    "free"
  );
  assert.equal(
    resolveEffectiveTenantPlanTier(
      "tenant_pro",
      "2026-01-01T00:00:00.000Z",
      Date.parse("2026-03-18T00:00:00.000Z")
    ),
    "free"
  );

  const snapshot = buildBillingSnapshot({
    profileId: "11111111-1111-1111-1111-111111111111",
    email: "tenant@example.com",
    role: "tenant",
    fullName: "Tenant User",
    plan: {
      plan_tier: "tenant_pro",
      billing_source: "manual",
      valid_until: "2026-01-01T00:00:00.000Z",
    },
    notes: null,
  });

  assert.equal(snapshot.planTier, "tenant_pro");
  assert.equal(snapshot.effectivePlanTier, "free");
  assert.equal(snapshot.isExpired, true);
  assert.equal(snapshot.manualOverrideActive, true);
});

void test("validateUpgradeRequestAction enforces admin role and reject reason", () => {
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("tenant"), false);

  const rejectWithoutNote = validateUpgradeRequestAction({
    action: "reject",
    role: "admin",
    note: "",
  });
  assert.equal(rejectWithoutNote.ok, false);

  const nonAdmin = validateUpgradeRequestAction({
    action: "approve",
    role: "tenant",
    note: null,
  });
  assert.equal(nonAdmin.ok, false);

  const approve = validateUpgradeRequestAction({
    action: "approve",
    role: "admin",
    note: null,
  });
  assert.equal(approve.ok, true);
});

void test("buildSupportSnapshot masks ids and includes recent events", () => {
  const snapshot = buildBillingSnapshot({
    profileId: "11111111-1111-1111-1111-111111111111",
    email: "support@propatyhub.com",
    role: "tenant",
    fullName: "Support User",
    plan: {
      plan_tier: "tenant_pro",
      billing_source: "stripe",
      stripe_customer_id: "cus_1234567890",
      stripe_subscription_id: "sub_1234567890",
      stripe_status: "active",
      valid_until: "2099-01-01T00:00:00.000Z",
    },
    notes: null,
  });

  const supportSnapshot = buildSupportSnapshot({
    snapshot,
    openUpgradeRequests: 2,
    events: [
      {
        event_type: "invoice.payment_failed",
        status: "failed",
        reason: "payment_failed",
        mode: "test",
        created_at: "2026-01-02T10:00:00.000Z",
        processed_at: "2026-01-02T10:00:01.000Z",
        event_id: "evt_1234567890",
        stripe_customer_id: "cus_1234567890",
        stripe_subscription_id: "sub_1234567890",
        stripe_price_id: "price_1234567890",
      },
    ],
  });

  assert.equal(supportSnapshot.email, "su***@propatyhub.com");
  assert.equal(supportSnapshot.open_upgrade_requests, 2);
  assert.equal(supportSnapshot.recent_events.length, 1);
  assert.equal(supportSnapshot.recent_events[0].event_id, "evt_12...7890");
  assert.equal(supportSnapshot.recent_events[0].stripe_price_id, "price_...7890");
});

void test("billing ops action panel includes operator safety guidance", () => {
  const filePath = path.join(process.cwd(), "components", "admin", "BillingOpsActions.tsx");
  const source = readFileSync(filePath, "utf8");

  assert.match(source, /Operator guidance/);
  assert.match(source, /Return to Stripe billing/);
  assert.match(source, /Replay Stripe event/);
  assert.match(source, /Reset billing test account/);
});
