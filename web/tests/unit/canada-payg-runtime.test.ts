import test from "node:test";
import assert from "node:assert/strict";
import {
  CANADA_RENTAL_PAYG_RUNTIME_PREREQUISITES,
  loadCanadaRentalPaygRuntimeDecision,
} from "@/lib/billing/canada-payg-runtime.server";
import { resolveCanadaRentalPaygReadiness } from "@/lib/billing/canada-payg-readiness.server";
import type {
  MarketBillingPolicyRow,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
} from "@/lib/billing/market-pricing";

const serviceClient = {} as never;

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

const pricingRows = {
  policies: [canadaPolicyDraft],
  entitlements: canadaEntitlements,
  oneOffPrices: canadaOneOffPrices,
};

void test("Canada runtime gate defaults off in the guarded adapter and keeps checkout disabled", async () => {
  const decision = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      listingId: "listing-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "long_term",
      role: "landlord",
      tier: "free",
      activeListingCount: 3,
    },
    {
      getGateEnabled: async () => false,
      loadPricingRows: async () => pricingRows,
      loadRoleContext: async () => ({ role: "landlord", tier: "free", activeListingCount: 3 }),
      resolveReadiness: resolveCanadaRentalPaygReadiness,
    }
  );

  assert.equal(decision.gateEnabled, false);
  assert.equal(decision.checkoutEnabled, false);
  assert.equal(decision.runtimeSource, "legacy");
  assert.equal(decision.resolverAvailable, true);
  assert.equal(decision.stripeSessionRequestDefined, true);
  assert.equal(decision.readiness.reasonCode, "POLICY_STATE_NOT_READY");
  assert.equal(decision.readiness.amountMinor, 400);
  assert.deepEqual(decision.nextActivationPrerequisites, [...CANADA_RENTAL_PAYG_RUNTIME_PREREQUISITES]);
});

void test("Canada runtime adapter passes normalized listing, role, tier, and pricing inputs into the readiness resolver", async () => {
  let captured: Record<string, unknown> | null = null;

  await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      listingId: "listing-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "long_term",
    },
    {
      getGateEnabled: async () => false,
      loadPricingRows: async () => pricingRows,
      loadRoleContext: async () => ({ role: "agent", tier: "pro", activeListingCount: 10 }),
      resolveReadiness: (input) => {
        captured = input;
        return resolveCanadaRentalPaygReadiness(input);
      },
    }
  );

  assert.ok(captured);
  assert.equal(captured?.marketCountry, "CA");
  assert.equal(captured?.listingIntent, "rent");
  assert.equal(captured?.rentalType, "long_term");
  assert.equal(captured?.role, "agent");
  assert.equal(captured?.tier, "pro");
  assert.equal(captured?.activeListingCount, 10);
  assert.equal((captured?.policies as MarketBillingPolicyRow[]).length, 1);
  assert.equal((captured?.entitlements as MarketListingEntitlementRow[]).length, 3);
  assert.equal((captured?.oneOffPrices as MarketOneOffPriceRow[]).length, 4);
});

void test("Canada runtime adapter keeps wrong market, shortlet, tenant, and enterprise blocked", async () => {
  const baseDeps = {
    getGateEnabled: async () => true,
    loadPricingRows: async () => pricingRows,
    resolveReadiness: resolveCanadaRentalPaygReadiness,
  };

  const wrongMarket = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      marketCountry: "NG",
      listingIntent: "rent",
      rentalType: "long_term",
      role: "landlord",
      tier: "free",
      activeListingCount: 3,
    },
    {
      ...baseDeps,
      loadRoleContext: async () => ({ role: "landlord", tier: "free", activeListingCount: 3 }),
    }
  );
  assert.equal(wrongMarket.readiness.reasonCode, "NON_CANADA_MARKET");

  const shortlet = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "short_let",
      role: "landlord",
      tier: "free",
      activeListingCount: 3,
    },
    {
      ...baseDeps,
      loadRoleContext: async () => ({ role: "landlord", tier: "free", activeListingCount: 3 }),
    }
  );
  assert.equal(shortlet.readiness.reasonCode, "SHORTLET_EXCLUDED");

  const tenant = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "long_term",
      role: "tenant",
      tier: "free",
      activeListingCount: 0,
    },
    {
      ...baseDeps,
      loadRoleContext: async () => ({ role: "tenant", tier: "free", activeListingCount: 0 }),
    }
  );
  assert.equal(tenant.readiness.reasonCode, "TENANT_DEMAND_ONLY");

  const enterprise = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "long_term",
      role: "agent",
      tier: "enterprise",
      activeListingCount: 50,
    },
    {
      ...baseDeps,
      loadRoleContext: async () => ({ role: "agent", tier: "enterprise", activeListingCount: 50 }),
    }
  );
  assert.equal(enterprise.readiness.reasonCode, "ENTERPRISE_PLANNING_ONLY");
});

void test("Canada runtime adapter can report runtime activation allowed while checkout remains disabled", async () => {
  const decision = await loadCanadaRentalPaygRuntimeDecision(
    {
      serviceClient,
      ownerId: "owner-1",
      marketCountry: "CA",
      listingIntent: "rent",
      rentalType: "long_term",
      role: "landlord",
      tier: "free",
      activeListingCount: 3,
    },
    {
      getGateEnabled: async () => true,
      loadPricingRows: async () => ({
        policies: [canadaPolicyLive],
        entitlements: canadaEntitlements,
        oneOffPrices: canadaOneOffPrices.map((row) =>
          row.id === "price-ca-landlord-free" ? { ...row, enabled: true } : row
        ),
      }),
      loadRoleContext: async () => ({ role: "landlord", tier: "free", activeListingCount: 3 }),
      resolveReadiness: resolveCanadaRentalPaygReadiness,
    }
  );

  assert.equal(decision.gateEnabled, true);
  assert.equal(decision.readiness.runtimeActivationAllowed, true);
  assert.equal(decision.checkoutEnabled, false);
});
