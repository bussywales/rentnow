import test from "node:test";
import assert from "node:assert/strict";

import { maskEmail, maskIdentifier } from "../../lib/billing/mask";
import { buildBillingSnapshot } from "../../lib/billing/snapshot";
import { isAdminRole, validateUpgradeRequestAction } from "../../lib/billing/admin-validation";
import { buildSupportSnapshot } from "../../lib/billing/support-snapshot";

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
      valid_until: "2026-01-01T00:00:00.000Z",
    },
    notes: {
      billing_notes: "VIP account",
    },
  });

  assert.equal(snapshot.planTier, "pro");
  assert.equal(snapshot.billingSource, "stripe");
  assert.equal(snapshot.stripeCustomerId, "cus_12...7890");
  assert.equal(snapshot.stripeSubscriptionId, "sub_12...7890");
  assert.equal(snapshot.stripePriceId, "price_...7890");
  assert.equal(snapshot.billingNotes, "VIP account");
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
      valid_until: "2026-01-01T00:00:00.000Z",
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
      },
    ],
  });

  assert.equal(supportSnapshot.email, "su***@propatyhub.com");
  assert.equal(supportSnapshot.open_upgrade_requests, 2);
  assert.equal(supportSnapshot.recent_events.length, 1);
  assert.equal(supportSnapshot.recent_events[0].event_id, "evt_12...7890");
});
