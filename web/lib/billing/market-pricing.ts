import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { PlanTier } from "@/lib/plans";

export type MarketPricingPolicyState = "draft" | "approved" | "live" | "disabled";
export type MarketBillingProvider = "stripe" | "paystack" | "flutterwave";
export type MarketOneOffProductCode =
  | "listing_submission"
  | "featured_listing_7d"
  | "featured_listing_30d";

export type MarketBillingPolicyRow = {
  id: string;
  market_country: string;
  currency: string;
  policy_state: MarketPricingPolicyState;
  rental_enabled: boolean;
  sale_enabled: boolean;
  shortlet_enabled: boolean;
  payg_listing_enabled: boolean;
  featured_listing_enabled: boolean;
  subscription_checkout_enabled: boolean;
  listing_payg_provider: MarketBillingProvider | null;
  featured_listing_provider: MarketBillingProvider | null;
  operator_notes: string | null;
  effective_from: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketListingEntitlementRow = {
  id: string;
  market_country: string;
  role: BillingRole;
  tier: PlanTier;
  active_listing_limit: number;
  listing_credits: number;
  featured_credits: number;
  client_page_limit: number | null;
  payg_beyond_cap_enabled: boolean;
  operator_notes: string | null;
  effective_from: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketOneOffPriceRow = {
  id: string;
  market_country: string;
  product_code: MarketOneOffProductCode;
  currency: string;
  amount_minor: number;
  provider: MarketBillingProvider;
  enabled: boolean;
  effective_from: string | null;
  active: boolean;
  operator_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketPricingAuditLogRow = {
  id: string;
  entity_type: "market_billing_policy" | "market_listing_entitlement" | "market_one_off_price";
  entity_id: string | null;
  market_country: string | null;
  event_type: string;
  actor_id: string | null;
  previous_snapshot: Record<string, unknown> | null;
  next_snapshot: Record<string, unknown> | null;
  created_at: string;
};

export type MarketPricingRuntimeDiagnostic = {
  key:
    | "subscription_pricing"
    | "payg_listing"
    | "featured_listing"
    | "listing_limits"
    | "market_control_plane";
  label: string;
  runtimeSource: string;
  status: "live" | "legacy" | "foundation";
  detail: string;
};

export type MarketPricingSummary = {
  policyRows: number;
  livePolicies: number;
  draftPolicies: number;
  disabledPolicies: number;
  approvedPolicies: number;
  activeEntitlementRows: number;
  activeOneOffPriceRows: number;
  enabledOneOffPriceRows: number;
  auditRows: number;
};

export function formatMarketPricingPolicyStateLabel(state: MarketPricingPolicyState) {
  if (state === "live") return "Live";
  if (state === "approved") return "Approved";
  if (state === "disabled") return "Disabled";
  return "Draft";
}

export function formatMarketPricingRoleLabel(role: BillingRole) {
  if (role === "tenant") return "Tenant";
  if (role === "landlord") return "Landlord";
  return "Agent";
}

export function formatMarketPricingTierLabel(tier: PlanTier) {
  if (tier === "tenant_pro") return "Tenant Pro";
  if (tier === "starter") return "Starter";
  if (tier === "pro") return "Pro";
  return "Free";
}

export function formatMarketPricingProductLabel(productCode: MarketOneOffProductCode) {
  if (productCode === "listing_submission") return "Listing submission";
  if (productCode === "featured_listing_7d") return "Featured listing 7 days";
  return "Featured listing 30 days";
}

export function getMarketPricingRuntimeDiagnostics(input?: {
  subscriptionPriceBookBacked?: boolean;
}): MarketPricingRuntimeDiagnostic[] {
  return [
    {
      key: "subscription_pricing",
      label: "Subscription pricing",
      runtimeSource: input?.subscriptionPriceBookBacked === false ? "Unavailable" : "subscription_price_book",
      status: "live",
      detail:
        "Recurring subscription checkout already resolves through the canonical subscription price book and its existing control plane.",
    },
    {
      key: "payg_listing",
      label: "PAYG listing",
      runtimeSource: "legacy app setting + code default",
      status: "legacy",
      detail:
        "Listing PAYG still resolves from app_settings.payg_listing_fee_amount and DEFAULT_PAYG_CURRENCY in web/lib/billing/payg.ts.",
    },
    {
      key: "featured_listing",
      label: "Featured listing one-off pricing",
      runtimeSource: "legacy app settings + code defaults",
      status: "legacy",
      detail:
        "Featured listing pricing still resolves through existing featured settings/helpers rather than the new market one-off price table.",
    },
    {
      key: "listing_limits",
      label: "Active listing limits",
      runtimeSource: "plans.ts + profile_plans.max_listings_override",
      status: "legacy",
      detail:
        "Active listing caps still come from code-defined plan gates in web/lib/plans.ts with optional per-user max_listings_override support.",
    },
    {
      key: "market_control_plane",
      label: "Market pricing tables",
      runtimeSource: "foundation only",
      status: "foundation",
      detail:
        "The new market pricing tables are seeded for admin visibility and audit, but checkout and entitlement runtime do not read them yet.",
    },
  ];
}

export function buildMarketPricingSummary(input: {
  policies: MarketBillingPolicyRow[];
  entitlements: MarketListingEntitlementRow[];
  oneOffPrices: MarketOneOffPriceRow[];
  auditRows: MarketPricingAuditLogRow[];
}): MarketPricingSummary {
  return {
    policyRows: input.policies.length,
    livePolicies: input.policies.filter((row) => row.policy_state === "live" && row.active).length,
    draftPolicies: input.policies.filter((row) => row.policy_state === "draft" && row.active).length,
    disabledPolicies: input.policies.filter((row) => row.policy_state === "disabled" && row.active).length,
    approvedPolicies: input.policies.filter((row) => row.policy_state === "approved" && row.active).length,
    activeEntitlementRows: input.entitlements.filter((row) => row.active).length,
    activeOneOffPriceRows: input.oneOffPrices.filter((row) => row.active).length,
    enabledOneOffPriceRows: input.oneOffPrices.filter((row) => row.active && row.enabled).length,
    auditRows: input.auditRows.length,
  };
}
