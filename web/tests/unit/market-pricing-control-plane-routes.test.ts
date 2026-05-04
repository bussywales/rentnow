import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import {
  getCanadaLiveBlockMessage,
  updateMarketBillingPolicy,
  updateMarketListingEntitlement,
  updateMarketOneOffPrice,
  type MarketPricingDbClient,
} from "@/lib/billing/market-pricing-control-plane-actions.server";
import { patchAdminMarketPricingPolicyResponse } from "@/app/api/admin/market-pricing/policies/[id]/route";
import { patchAdminMarketPricingOneOffPriceResponse } from "@/app/api/admin/market-pricing/one-off-prices/[id]/route";
import { patchAdminMarketPricingEntitlementResponse } from "@/app/api/admin/market-pricing/entitlements/[id]/route";
import type {
  MarketBillingPolicyRow,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
} from "@/lib/billing/market-pricing";

type Tables = {
  market_billing_policies: MarketBillingPolicyRow[];
  market_one_off_price_book: MarketOneOffPriceRow[];
  market_listing_entitlements: MarketListingEntitlementRow[];
  market_pricing_audit_log: Array<Record<string, unknown>>;
};

const policyRow: MarketBillingPolicyRow = {
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
  operator_notes: "Legacy runtime mirror",
  effective_from: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: "2026-05-04T10:00:00.000Z",
  updated_at: "2026-05-04T10:00:00.000Z",
};

const canadaPolicyRow: MarketBillingPolicyRow = {
  ...policyRow,
  id: "policy-ca",
  market_country: "CA",
  currency: "CAD",
  policy_state: "draft",
  payg_listing_enabled: false,
  featured_listing_enabled: false,
  subscription_checkout_enabled: false,
  listing_payg_provider: "stripe",
  featured_listing_provider: "stripe",
  operator_notes: "Canada PAYG policy approval pending.",
};

const oneOffPriceRow: MarketOneOffPriceRow = {
  id: "price-ng-listing",
  market_country: "NG",
  product_code: "listing_submission",
  currency: "NGN",
  amount_minor: 2000,
  provider: "paystack",
  enabled: true,
  effective_from: null,
  active: true,
  operator_notes: "Legacy PAYG mirror",
  created_by: null,
  updated_by: null,
  created_at: "2026-05-04T10:00:00.000Z",
  updated_at: "2026-05-04T10:00:00.000Z",
};

const entitlementRow: MarketListingEntitlementRow = {
  id: "ent-ng-landlord-free",
  market_country: "NG",
  role: "landlord",
  tier: "free",
  active_listing_limit: 1,
  listing_credits: 0,
  featured_credits: 0,
  client_page_limit: null,
  payg_beyond_cap_enabled: false,
  operator_notes: "Legacy plan mirror",
  effective_from: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: "2026-05-04T10:00:00.000Z",
  updated_at: "2026-05-04T10:00:00.000Z",
};

function buildClient(seed?: Partial<Tables>) {
  const tables: Tables = {
    market_billing_policies: seed?.market_billing_policies?.map((row) => ({ ...row })) ?? [
      { ...policyRow },
      { ...canadaPolicyRow },
    ],
    market_one_off_price_book: seed?.market_one_off_price_book?.map((row) => ({ ...row })) ?? [
      { ...oneOffPriceRow },
    ],
    market_listing_entitlements: seed?.market_listing_entitlements?.map((row) => ({ ...row })) ?? [
      { ...entitlementRow },
    ],
    market_pricing_audit_log: seed?.market_pricing_audit_log?.map((row) => ({ ...row })) ?? [],
  };

  const client: MarketPricingDbClient = {
    from(tableName: string) {
      const table = tables[tableName as keyof Tables] as Array<Record<string, unknown>>;
      if (!table) {
        throw new Error(`Unexpected table ${tableName}`);
      }
      return {
        select() {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle: async () => ({
                  data: table.find((row) => row[column] === value) ?? null,
                  error: null,
                }),
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq: async (column: string, value: string) => {
              const index = table.findIndex((row) => row[column] === value);
              if (index === -1) return { error: { message: "Row not found" } };
              table[index] = {
                ...table[index],
                ...payload,
                updated_at: "2026-05-04T12:00:00.000Z",
              };
              return { error: null };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          table.push({ ...payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client, tables };
}

const makePatchRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/admin/market-pricing/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

void test("market pricing policy route denies anonymous requests", async () => {
  const response = await patchAdminMarketPricingPolicyResponse(
    makePatchRequest({ policy_state: "draft" }),
    { params: { id: "policy-ng" } },
    {
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }) as never,
    }
  );

  assert.equal(response.status, 401);
});

void test("market pricing one-off route denies non-admin requests", async () => {
  const response = await patchAdminMarketPricingOneOffPriceResponse(
    makePatchRequest({ amount_minor: 2000 }),
    { params: { id: "price-ng-listing" } },
    {
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        }) as never,
    }
  );

  assert.equal(response.status, 403);
});

void test("market pricing entitlement route allows admin updates", async () => {
  const response = await patchAdminMarketPricingEntitlementResponse(
    makePatchRequest({ active_listing_limit: 2 }),
    { params: { id: "ent-ng-landlord-free" } },
    {
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          supabase: {} as never,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      updateMarketListingEntitlement: async () =>
        ({
          ok: true,
          row: { ...entitlementRow, active_listing_limit: 2 },
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.row.active_listing_limit, 2);
});

void test("market pricing policy route allows admin updates", async () => {
  const response = await patchAdminMarketPricingPolicyResponse(
    makePatchRequest({ policy_state: "approved" }),
    { params: { id: "policy-ng" } },
    {
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          supabase: {} as never,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      updateMarketBillingPolicy: async () =>
        ({
          ok: true,
          row: { ...policyRow, policy_state: "approved" },
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.row.policy_state, "approved");
});

void test("market pricing one-off route allows admin updates", async () => {
  const response = await patchAdminMarketPricingOneOffPriceResponse(
    makePatchRequest({ amount_minor: 4500 }),
    { params: { id: "price-ng-listing" } },
    {
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          supabase: {} as never,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      updateMarketOneOffPrice: async () =>
        ({
          ok: true,
          row: { ...oneOffPriceRow, amount_minor: 4500 },
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.row.amount_minor, 4500);
});

void test("policy action accepts valid updates and writes audit history", async () => {
  const { client, tables } = buildClient();
  const result = await updateMarketBillingPolicy({
    client,
    actorId: "admin-1",
    id: "policy-ng",
    payload: {
      policy_state: "approved",
      rental_enabled: true,
      sale_enabled: true,
      shortlet_enabled: false,
      payg_listing_enabled: true,
      featured_listing_enabled: true,
      subscription_checkout_enabled: false,
      listing_payg_provider: "paystack",
      featured_listing_provider: "paystack",
      operator_notes: "Approved for staging review",
      effective_from: "2026-05-05T00:00:00.000Z",
      active: true,
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.row.policy_state, "approved");
  assert.equal(tables.market_pricing_audit_log.length, 1);
  assert.equal(tables.market_pricing_audit_log[0]?.entity_type, "market_billing_policy");
  assert.equal(tables.market_pricing_audit_log[0]?.actor_id, "admin-1");
  assert.equal(
    (tables.market_pricing_audit_log[0]?.previous_snapshot as Record<string, unknown>)?.policy_state,
    "live"
  );
  assert.equal(
    (tables.market_pricing_audit_log[0]?.next_snapshot as Record<string, unknown>)?.policy_state,
    "approved"
  );
});

void test("policy action rejects invalid policy state payloads", async () => {
  const { client } = buildClient();
  const result = await updateMarketBillingPolicy({
    client,
    actorId: "admin-1",
    id: "policy-ng",
    payload: {
      policy_state: "broken",
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});

void test("policy action blocks Canada live activation", async () => {
  const { client } = buildClient();
  const result = await updateMarketBillingPolicy({
    client,
    actorId: "admin-1",
    id: "policy-ca",
    payload: {
      policy_state: "live",
      rental_enabled: true,
      sale_enabled: false,
      shortlet_enabled: false,
      payg_listing_enabled: false,
      featured_listing_enabled: false,
      subscription_checkout_enabled: false,
      listing_payg_provider: "stripe",
      featured_listing_provider: "stripe",
      operator_notes: "Policy approval noted.",
      effective_from: null,
      active: true,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 409);
  assert.equal(result.error, getCanadaLiveBlockMessage());
});

void test("one-off price action accepts valid updates and writes audit history", async () => {
  const { client, tables } = buildClient();
  const result = await updateMarketOneOffPrice({
    client,
    actorId: "admin-1",
    id: "price-ng-listing",
    payload: {
      amount_minor: 4500,
      provider: "paystack",
      enabled: false,
      operator_notes: "Hold until runtime integration",
      effective_from: "2026-05-06T00:00:00.000Z",
      active: true,
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.row.amount_minor, 4500);
  assert.equal(tables.market_pricing_audit_log[0]?.entity_type, "market_one_off_price");
  assert.equal((tables.market_pricing_audit_log[0]?.next_snapshot as Record<string, unknown>)?.amount_minor, 4500);
});

void test("one-off price action rejects negative amounts", async () => {
  const { client } = buildClient();
  const result = await updateMarketOneOffPrice({
    client,
    actorId: "admin-1",
    id: "price-ng-listing",
    payload: {
      amount_minor: -1,
      provider: "paystack",
      enabled: false,
      operator_notes: null,
      effective_from: null,
      active: true,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});

void test("one-off price action rejects invalid providers", async () => {
  const { client } = buildClient();
  const result = await updateMarketOneOffPrice({
    client,
    actorId: "admin-1",
    id: "price-ng-listing",
    payload: {
      amount_minor: 100,
      provider: "invalid-provider",
      enabled: true,
      operator_notes: null,
      effective_from: null,
      active: true,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});

void test("entitlement action accepts valid updates and writes audit history", async () => {
  const { client, tables } = buildClient();
  const result = await updateMarketListingEntitlement({
    client,
    actorId: "admin-1",
    id: "ent-ng-landlord-free",
    payload: {
      active_listing_limit: 3,
      listing_credits: 2,
      featured_credits: 1,
      client_page_limit: 4,
      payg_beyond_cap_enabled: false,
      operator_notes: "Pilot modelling only",
      effective_from: "2026-05-07T00:00:00.000Z",
      active: true,
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.row.active_listing_limit, 3);
  assert.equal(tables.market_pricing_audit_log[0]?.entity_type, "market_listing_entitlement");
  assert.equal(
    (tables.market_pricing_audit_log[0]?.next_snapshot as Record<string, unknown>)?.listing_credits,
    2
  );
});

void test("entitlement action rejects negative listing limits", async () => {
  const { client } = buildClient();
  const result = await updateMarketListingEntitlement({
    client,
    actorId: "admin-1",
    id: "ent-ng-landlord-free",
    payload: {
      active_listing_limit: -1,
      listing_credits: 0,
      featured_credits: 0,
      client_page_limit: null,
      payg_beyond_cap_enabled: false,
      operator_notes: null,
      effective_from: null,
      active: true,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});

void test("entitlement action rejects negative credits", async () => {
  const { client } = buildClient();
  const result = await updateMarketListingEntitlement({
    client,
    actorId: "admin-1",
    id: "ent-ng-landlord-free",
    payload: {
      active_listing_limit: 1,
      listing_credits: -1,
      featured_credits: 0,
      client_page_limit: null,
      payg_beyond_cap_enabled: false,
      operator_notes: null,
      effective_from: null,
      active: true,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
});
