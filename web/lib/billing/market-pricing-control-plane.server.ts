import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { loadSubscriptionPriceBookRows } from "@/lib/billing/subscription-price-book.repository";
import {
  buildMarketPricingSummary,
  getMarketPricingRuntimeDiagnostics,
  type MarketBillingPolicyRow,
  type MarketListingEntitlementRow,
  type MarketOneOffPriceRow,
  type MarketPricingAuditLogRow,
  type MarketPricingControlPlaneTier,
} from "@/lib/billing/market-pricing";

export type AdminMarketPricingControlPlaneState = {
  policies: MarketBillingPolicyRow[];
  entitlements: MarketListingEntitlementRow[];
  oneOffPrices: MarketOneOffPriceRow[];
  auditRows: MarketPricingAuditLogRow[];
  summary: ReturnType<typeof buildMarketPricingSummary>;
  diagnostics: ReturnType<typeof getMarketPricingRuntimeDiagnostics>;
};

async function createMarketPricingControlPlaneClient() {
  if (hasServiceRoleEnv()) return createServiceRoleClient();
  if (hasServerSupabaseEnv()) return createServerSupabaseClient();
  return null;
}

function sortPolicies(rows: MarketBillingPolicyRow[]) {
  return rows.slice().sort((a, b) => {
    if (a.market_country !== b.market_country) return a.market_country.localeCompare(b.market_country);
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  });
}

function sortEntitlements(rows: MarketListingEntitlementRow[]) {
  const roleOrder = { tenant: 10, landlord: 20, agent: 30 } as const;
  const tierOrder = { free: 10, starter: 20, pro: 30, tenant_pro: 40 } as const;
  return rows.slice().sort((a, b) => {
    if (a.market_country !== b.market_country) return a.market_country.localeCompare(b.market_country);
    if (a.role !== b.role) return roleOrder[a.role] - roleOrder[b.role];
    if (a.tier !== b.tier) return tierOrder[a.tier] - tierOrder[b.tier];
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  });
}

function sortOneOffPrices(rows: MarketOneOffPriceRow[]) {
  const productOrder = {
    listing_submission: 10,
    featured_listing_7d: 20,
    featured_listing_30d: 30,
  } as const;
  const roleOrder = {
    __all__: 0,
    landlord: 10,
    agent: 20,
    tenant: 30,
  } as const;
  const tierOrder: Record<MarketPricingControlPlaneTier | "__all__", number> = {
    __all__: 0,
    free: 10,
    starter: 20,
    pro: 30,
    tenant_pro: 40,
    enterprise: 50,
  };
  return rows.slice().sort((a, b) => {
    if (a.market_country !== b.market_country) return a.market_country.localeCompare(b.market_country);
    if (a.product_code !== b.product_code) return productOrder[a.product_code] - productOrder[b.product_code];
    const aRole = a.role ?? "__all__";
    const bRole = b.role ?? "__all__";
    if (aRole !== bRole) return roleOrder[aRole] - roleOrder[bRole];
    const aTier = a.tier ?? "__all__";
    const bTier = b.tier ?? "__all__";
    if (aTier !== bTier) return tierOrder[aTier] - tierOrder[bTier];
    return a.provider.localeCompare(b.provider);
  });
}

function sortAuditRows(rows: MarketPricingAuditLogRow[]) {
  return rows.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function loadAdminMarketPricingControlPlane(
  client?: SupabaseClient
): Promise<AdminMarketPricingControlPlaneState> {
  const supabase = client ?? (await createMarketPricingControlPlaneClient());
  const subscriptionPriceBookRows = await loadSubscriptionPriceBookRows();

  if (!supabase) {
    const empty = {
      policies: [] as MarketBillingPolicyRow[],
      entitlements: [] as MarketListingEntitlementRow[],
      oneOffPrices: [] as MarketOneOffPriceRow[],
      auditRows: [] as MarketPricingAuditLogRow[],
    };
    return {
      ...empty,
      summary: buildMarketPricingSummary(empty),
      diagnostics: getMarketPricingRuntimeDiagnostics({
        subscriptionPriceBookBacked: subscriptionPriceBookRows.length > 0,
      }),
    };
  }

  const [policiesResult, entitlementsResult, oneOffPricesResult, auditResult] = await Promise.all([
    supabase
      .from("market_billing_policies")
      .select(
        "id,market_country,currency,policy_state,rental_enabled,sale_enabled,shortlet_enabled,payg_listing_enabled,featured_listing_enabled,subscription_checkout_enabled,listing_payg_provider,featured_listing_provider,operator_notes,effective_from,active,created_by,updated_by,created_at,updated_at"
      ),
    supabase
      .from("market_listing_entitlements")
      .select(
        "id,market_country,role,tier,active_listing_limit,listing_credits,featured_credits,client_page_limit,payg_beyond_cap_enabled,operator_notes,effective_from,active,created_by,updated_by,created_at,updated_at"
      ),
    supabase
      .from("market_one_off_price_book")
      .select(
        "id,market_country,product_code,currency,amount_minor,provider,role,tier,enabled,effective_from,active,operator_notes,created_by,updated_by,created_at,updated_at"
      ),
    supabase
      .from("market_pricing_audit_log")
      .select(
        "id,entity_type,entity_id,market_country,event_type,actor_id,previous_snapshot,next_snapshot,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const policies = sortPolicies(((policiesResult.data ?? []) as MarketBillingPolicyRow[]).filter(Boolean));
  const entitlements = sortEntitlements(
    ((entitlementsResult.data ?? []) as MarketListingEntitlementRow[]).filter(Boolean)
  );
  const oneOffPrices = sortOneOffPrices(
    ((oneOffPricesResult.data ?? []) as MarketOneOffPriceRow[]).filter(Boolean)
  );
  const auditRows = sortAuditRows(((auditResult.data ?? []) as MarketPricingAuditLogRow[]).filter(Boolean));

  return {
    policies,
    entitlements,
    oneOffPrices,
    auditRows,
    summary: buildMarketPricingSummary({
      policies,
      entitlements,
      oneOffPrices,
      auditRows,
    }),
    diagnostics: getMarketPricingRuntimeDiagnostics({
      subscriptionPriceBookBacked: subscriptionPriceBookRows.length > 0,
    }),
  };
}
