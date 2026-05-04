import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketPricingSummary,
  formatMarketPricingPolicyStateLabel,
  formatMarketPricingProductLabel,
  getMarketPricingRuntimeDiagnostics,
  type MarketBillingPolicyRow,
  type MarketListingEntitlementRow,
  type MarketOneOffPriceRow,
  type MarketPricingAuditLogRow,
} from "@/lib/billing/market-pricing";

const policies: MarketBillingPolicyRow[] = [
  {
    id: "policy-ng",
    market_country: "NG",
    currency: "NGN",
    policy_state: "live",
    rental_enabled: true,
    sale_enabled: true,
    shortlet_enabled: true,
    payg_listing_enabled: true,
    featured_listing_enabled: true,
    subscription_checkout_enabled: false,
    listing_payg_provider: "paystack",
    featured_listing_provider: "paystack",
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "policy-ca",
    market_country: "CA",
    currency: "CAD",
    policy_state: "draft",
    rental_enabled: false,
    sale_enabled: false,
    shortlet_enabled: false,
    payg_listing_enabled: false,
    featured_listing_enabled: false,
    subscription_checkout_enabled: false,
    listing_payg_provider: "stripe",
    featured_listing_provider: "stripe",
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
];

const entitlements: MarketListingEntitlementRow[] = [
  {
    id: "ent-1",
    market_country: "NG",
    role: "landlord",
    tier: "free",
    active_listing_limit: 1,
    listing_credits: 0,
    featured_credits: 0,
    client_page_limit: null,
    payg_beyond_cap_enabled: false,
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
];

const oneOffPrices: MarketOneOffPriceRow[] = [
  {
    id: "price-1",
    market_country: "NG",
    product_code: "listing_submission",
    currency: "NGN",
    amount_minor: 2000,
    provider: "paystack",
    enabled: true,
    effective_from: null,
    active: true,
    operator_notes: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "price-2",
    market_country: "NG",
    product_code: "featured_listing_7d",
    currency: "NGN",
    amount_minor: 1999,
    provider: "paystack",
    enabled: false,
    effective_from: null,
    active: true,
    operator_notes: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
];

const auditRows: MarketPricingAuditLogRow[] = [
  {
    id: "audit-1",
    entity_type: "market_billing_policy",
    entity_id: "policy-ng",
    market_country: "NG",
    event_type: "seeded",
    actor_id: null,
    previous_snapshot: null,
    next_snapshot: { market_country: "NG" },
    created_at: "2026-05-04T10:00:00.000Z",
  },
];

void test("market pricing summary counts seeded policy, entitlement, price, and audit rows", () => {
  const summary = buildMarketPricingSummary({
    policies,
    entitlements,
    oneOffPrices,
    auditRows,
  });

  assert.equal(summary.policyRows, 2);
  assert.equal(summary.livePolicies, 1);
  assert.equal(summary.draftPolicies, 1);
  assert.equal(summary.activeEntitlementRows, 1);
  assert.equal(summary.activeOneOffPriceRows, 2);
  assert.equal(summary.enabledOneOffPriceRows, 1);
  assert.equal(summary.auditRows, 1);
});

void test("market pricing runtime diagnostics stay explicit that PAYG and listing caps are still legacy-backed", () => {
  const diagnostics = getMarketPricingRuntimeDiagnostics({ subscriptionPriceBookBacked: true });

  const payg = diagnostics.find((row) => row.key === "payg_listing");
  const limits = diagnostics.find((row) => row.key === "listing_limits");
  const marketControlPlane = diagnostics.find((row) => row.key === "market_control_plane");

  assert.ok(payg);
  assert.equal(payg?.status, "legacy");
  assert.match(payg?.runtimeSource ?? "", /legacy app setting/i);
  assert.ok(limits);
  assert.match(limits?.runtimeSource ?? "", /plans\.ts/i);
  assert.ok(marketControlPlane);
  assert.equal(marketControlPlane?.status, "foundation");
  assert.match(marketControlPlane?.detail ?? "", /do not read them yet/i);
});

void test("market pricing labels stay operator-readable", () => {
  assert.equal(formatMarketPricingPolicyStateLabel("draft"), "Draft");
  assert.equal(formatMarketPricingPolicyStateLabel("live"), "Live");
  assert.equal(formatMarketPricingProductLabel("listing_submission"), "Listing submission");
  assert.equal(formatMarketPricingProductLabel("featured_listing_30d"), "Featured listing 30 days");
});
