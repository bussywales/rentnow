import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCanadaRentalPaygPriceRow,
  resolveCanadaRentalPaygReadiness,
  type CanadaRentalPaygReadinessInput,
} from "@/lib/billing/canada-payg-readiness.server";
import type {
  MarketBillingPolicyRow,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
} from "@/lib/billing/market-pricing";

const canadaPolicyDraft: MarketBillingPolicyRow = {
  id: "policy-ca",
  market_country: "CA",
  currency: "CAD",
  policy_state: "draft",
  rental_enabled: true,
  sale_enabled: false,
  shortlet_enabled: false,
  payg_listing_enabled: true,
  featured_listing_enabled: true,
  subscription_checkout_enabled: false,
  listing_payg_provider: "stripe",
  featured_listing_provider: "stripe",
  operator_notes: "Canada policy approval pending.",
  effective_from: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: "2026-05-04T10:00:00.000Z",
  updated_at: "2026-05-04T10:00:00.000Z",
};

const canadaPolicyLive: MarketBillingPolicyRow = {
  ...canadaPolicyDraft,
  id: "policy-ca-live",
  policy_state: "live",
};

const canadaEntitlements: MarketListingEntitlementRow[] = [
  {
    id: "ent-ca-landlord-free",
    market_country: "CA",
    role: "landlord",
    tier: "free",
    active_listing_limit: 3,
    listing_credits: 0,
    featured_credits: 0,
    client_page_limit: null,
    payg_beyond_cap_enabled: true,
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "ent-ca-agent-free",
    market_country: "CA",
    role: "agent",
    tier: "free",
    active_listing_limit: 5,
    listing_credits: 0,
    featured_credits: 0,
    client_page_limit: 1,
    payg_beyond_cap_enabled: true,
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "ent-ca-agent-pro",
    market_country: "CA",
    role: "agent",
    tier: "pro",
    active_listing_limit: 10,
    listing_credits: 0,
    featured_credits: 1,
    client_page_limit: 5,
    payg_beyond_cap_enabled: true,
    operator_notes: null,
    effective_from: null,
    active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
];

const canadaOneOffPrices: MarketOneOffPriceRow[] = [
  {
    id: "price-ca-generic",
    market_country: "CA",
    product_code: "listing_submission",
    currency: "CAD",
    amount_minor: 600,
    provider: "stripe",
    role: null,
    tier: null,
    enabled: false,
    effective_from: null,
    active: true,
    operator_notes: "Fallback planning row only.",
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "price-ca-landlord-free",
    market_country: "CA",
    product_code: "listing_submission",
    currency: "CAD",
    amount_minor: 400,
    provider: "stripe",
    role: "landlord",
    tier: "free",
    enabled: false,
    effective_from: null,
    active: true,
    operator_notes: "Planning row only.",
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "price-ca-agent-free",
    market_country: "CA",
    product_code: "listing_submission",
    currency: "CAD",
    amount_minor: 400,
    provider: "stripe",
    role: "agent",
    tier: "free",
    enabled: false,
    effective_from: null,
    active: true,
    operator_notes: "Planning row only.",
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "price-ca-agent-pro",
    market_country: "CA",
    product_code: "listing_submission",
    currency: "CAD",
    amount_minor: 200,
    provider: "stripe",
    role: "agent",
    tier: "pro",
    enabled: false,
    effective_from: null,
    active: true,
    operator_notes: "Planning row only.",
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
  {
    id: "price-ca-agent-enterprise",
    market_country: "CA",
    product_code: "listing_submission",
    currency: "CAD",
    amount_minor: 100,
    provider: "stripe",
    role: "agent",
    tier: "enterprise",
    enabled: false,
    effective_from: null,
    active: false,
    operator_notes: "Enterprise planning row only.",
    created_by: null,
    updated_by: null,
    created_at: "2026-05-04T10:00:00.000Z",
    updated_at: "2026-05-04T10:00:00.000Z",
  },
];

function makeInput(overrides: Partial<CanadaRentalPaygReadinessInput> = {}): CanadaRentalPaygReadinessInput {
  return {
    marketCountry: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    role: "landlord",
    tier: "free",
    activeListingCount: 3,
    policies: [canadaPolicyDraft],
    entitlements: canadaEntitlements,
    oneOffPrices: canadaOneOffPrices,
    ...overrides,
  };
}

void test("Canada landlord free planning case resolves CA$4 row but keeps runtime activation and checkout blocked", () => {
  const result = resolveCanadaRentalPaygReadiness(makeInput());

  assert.equal(result.eligible, true);
  assert.equal(result.reasonCode, "POLICY_STATE_NOT_READY");
  assert.equal(result.marketCountry, "CA");
  assert.equal(result.currency, "CAD");
  assert.equal(result.provider, "stripe");
  assert.equal(result.amountMinor, 400);
  assert.equal(result.role, "landlord");
  assert.equal(result.tier, "free");
  assert.equal(result.runtimeActivationAllowed, false);
  assert.equal(result.checkoutEnabled, false);
  assert.ok(result.warnings.some((warning) => /legacy-backed/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /checkout is intentionally disabled/i.test(warning)));
});

void test("Canada agent pro resolves the CA$2 tier-specific planning row", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      role: "agent",
      tier: "pro",
      activeListingCount: 10,
    })
  );

  assert.equal(result.eligible, true);
  assert.equal(result.amountMinor, 200);
  assert.equal(result.role, "agent");
  assert.equal(result.tier, "pro");
  assert.equal(result.reasonCode, "POLICY_STATE_NOT_READY");
  assert.equal(result.checkoutEnabled, false);
});

void test("Canada enterprise rows stay planning-only", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      role: "agent",
      tier: "enterprise",
      activeListingCount: 50,
    })
  );

  assert.equal(result.status, "planning_only");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "ENTERPRISE_PLANNING_ONLY");
  assert.equal(result.amountMinor, 100);
  assert.equal(result.checkoutEnabled, false);
});

void test("tenant supply-side Canada PAYG stays rejected", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      role: "tenant",
      tier: "free",
    })
  );

  assert.equal(result.status, "not_applicable");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "TENANT_DEMAND_ONLY");
});

void test("non-Canada markets are rejected by the Canada-specific resolver", () => {
  const gbResult = resolveCanadaRentalPaygReadiness(makeInput({ marketCountry: "GB" }));
  const ngResult = resolveCanadaRentalPaygReadiness(makeInput({ marketCountry: "NG" }));

  assert.equal(gbResult.reasonCode, "NON_CANADA_MARKET");
  assert.equal(ngResult.reasonCode, "NON_CANADA_MARKET");
  assert.equal(gbResult.eligible, false);
  assert.equal(ngResult.eligible, false);
});

void test("sale, off-plan, and shortlet are rejected by Canada rental PAYG readiness", () => {
  const saleResult = resolveCanadaRentalPaygReadiness(makeInput({ listingIntent: "sale" }));
  const offPlanResult = resolveCanadaRentalPaygReadiness(makeInput({ listingIntent: "off_plan" }));
  const shortletResult = resolveCanadaRentalPaygReadiness(
    makeInput({ listingIntent: "shortlet", rentalType: "short_let" })
  );

  assert.equal(saleResult.reasonCode, "SALE_DEFERRED");
  assert.equal(offPlanResult.reasonCode, "OFF_PLAN_DEFERRED");
  assert.equal(shortletResult.reasonCode, "SHORTLET_EXCLUDED");
});

void test("missing price rows block readiness with a clear reason", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      policies: [canadaPolicyLive],
      oneOffPrices: canadaOneOffPrices.filter(
        (row) => row.id !== "price-ca-landlord-free" && row.id !== "price-ca-generic"
      ),
    })
  );

  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "PRICE_ROW_MISSING");
});

void test("wrong provider or currency blocks readiness clearly", () => {
  const providerResult = resolveCanadaRentalPaygReadiness(
    makeInput({
      oneOffPrices: canadaOneOffPrices.map((row) =>
        row.id === "price-ca-landlord-free" ? { ...row, provider: "paystack" } : row
      ),
    })
  );
  const currencyResult = resolveCanadaRentalPaygReadiness(
    makeInput({
      oneOffPrices: canadaOneOffPrices.map((row) =>
        row.id === "price-ca-landlord-free" ? { ...row, currency: "NGN" } : row
      ),
    })
  );

  assert.equal(providerResult.reasonCode, "POLICY_STATE_NOT_READY");
  assert.ok(providerResult.blockers.includes("PRICE_PROVIDER_NOT_STRIPE"));
  assert.equal(currencyResult.reasonCode, "POLICY_STATE_NOT_READY");
  assert.ok(currencyResult.blockers.includes("PRICE_CURRENCY_NOT_CAD"));
});

void test("approved or live policy still blocks runtime activation if the matched price row is disabled", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      policies: [canadaPolicyLive],
    })
  );

  assert.equal(result.eligible, true);
  assert.equal(result.runtimeActivationAllowed, false);
  assert.equal(result.reasonCode, "PRICE_ROW_DISABLED");
});

void test("live policy plus enabled active price row can be runtime-ready while checkout stays disabled in this batch", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      policies: [canadaPolicyLive],
      oneOffPrices: canadaOneOffPrices.map((row) =>
        row.id === "price-ca-landlord-free" ? { ...row, enabled: true } : row
      ),
    })
  );

  assert.equal(result.status, "ready");
  assert.equal(result.eligible, true);
  assert.equal(result.reasonCode, "READY_FOR_RUNTIME_INTEGRATION");
  assert.equal(result.runtimeActivationAllowed, true);
  assert.equal(result.checkoutEnabled, false);
});

void test("under-cap listings are not blocked but also do not require beyond-cap Canada PAYG", () => {
  const result = resolveCanadaRentalPaygReadiness(
    makeInput({
      activeListingCount: 1,
      policies: [canadaPolicyLive],
      oneOffPrices: canadaOneOffPrices.map((row) =>
        row.id === "price-ca-landlord-free" ? { ...row, enabled: true } : row
      ),
    })
  );

  assert.equal(result.status, "not_needed");
  assert.equal(result.reasonCode, "UNDER_INCLUDED_CAP");
  assert.equal(result.runtimeActivationAllowed, false);
});

void test("role/tier price resolution prefers exact rows, then role-only rows, then all-role rows", () => {
  const rows: MarketOneOffPriceRow[] = [
    {
      ...canadaOneOffPrices[0],
      id: "all-roles",
      role: null,
      tier: null,
      amount_minor: 999,
      enabled: true,
    },
    {
      ...canadaOneOffPrices[0],
      id: "agent-role-only",
      role: "agent",
      tier: null,
      amount_minor: 333,
      enabled: true,
    },
    {
      ...canadaOneOffPrices[0],
      id: "agent-pro-exact",
      role: "agent",
      tier: "pro",
      amount_minor: 222,
      enabled: true,
    },
  ];

  const exact = resolveCanadaRentalPaygPriceRow({
    oneOffPrices: rows,
    role: "agent",
    tier: "pro",
  });
  const roleOnly = resolveCanadaRentalPaygPriceRow({
    oneOffPrices: rows.filter((row) => row.id !== "agent-pro-exact"),
    role: "agent",
    tier: "pro",
  });
  const generic = resolveCanadaRentalPaygPriceRow({
    oneOffPrices: rows.filter((row) => row.id === "all-roles"),
    role: "agent",
    tier: "pro",
  });

  assert.equal(exact?.id, "agent-pro-exact");
  assert.equal(roleOnly?.id, "agent-role-only");
  assert.equal(generic?.id, "all-roles");
});
