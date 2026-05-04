import type { BillingRole } from "@/lib/billing/stripe-plans";
import type {
  MarketBillingPolicyRow,
  MarketBillingProvider,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
  MarketPricingControlPlaneTier,
  MarketPricingPolicyState,
} from "@/lib/billing/market-pricing";
import { isRentIntent, isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import { normalizePlanTier, normalizeTenantPlanTier } from "@/lib/plans";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import type { UserRole } from "@/lib/types";

export type CanadaRentalPaygReadinessStatus =
  | "ready"
  | "blocked"
  | "not_applicable"
  | "not_needed"
  | "planning_only";

export type CanadaRentalPaygReadinessBlocker =
  | "NON_CANADA_MARKET"
  | "ROLE_NOT_SUPPORTED"
  | "TENANT_DEMAND_ONLY"
  | "SHORTLET_EXCLUDED"
  | "SALE_DEFERRED"
  | "OFF_PLAN_DEFERRED"
  | "NON_RENTAL_LISTING"
  | "POLICY_ROW_MISSING"
  | "POLICY_STATE_NOT_READY"
  | "RENTAL_LANE_DISABLED"
  | "PAYG_POLICY_DISABLED"
  | "POLICY_PROVIDER_NOT_STRIPE"
  | "POLICY_CURRENCY_NOT_CAD"
  | "ENTITLEMENT_ROW_MISSING"
  | "BEYOND_CAP_NOT_ENABLED"
  | "PRICE_ROW_MISSING"
  | "PRICE_ROW_INACTIVE"
  | "PRICE_ROW_DISABLED"
  | "PRICE_PROVIDER_NOT_STRIPE"
  | "PRICE_CURRENCY_NOT_CAD"
  | "ENTERPRISE_PLANNING_ONLY";

export type CanadaRentalPaygReadinessReasonCode =
  | CanadaRentalPaygReadinessBlocker
  | "READY_FOR_RUNTIME_INTEGRATION"
  | "CHECKOUT_DISABLED_IN_THIS_BATCH"
  | "UNDER_INCLUDED_CAP";

export type CanadaRentalPaygReadinessInput = {
  marketCountry?: string | null;
  listingIntent?: string | null;
  rentalType?: string | null;
  role?: UserRole | BillingRole | null;
  tier?: string | null;
  activeListingCount?: number | null;
  policies: MarketBillingPolicyRow[];
  entitlements: MarketListingEntitlementRow[];
  oneOffPrices: MarketOneOffPriceRow[];
};

export type CanadaRentalPaygReadinessResult = {
  status: CanadaRentalPaygReadinessStatus;
  eligible: boolean;
  reasonCode: CanadaRentalPaygReadinessReasonCode;
  blockers: CanadaRentalPaygReadinessBlocker[];
  marketCountry: string | null;
  role: BillingRole | null;
  tier: MarketPricingControlPlaneTier | null;
  normalizedIntent: ReturnType<typeof normalizeListingIntent>;
  isShortlet: boolean;
  policyState: MarketPricingPolicyState | null;
  activeListingCount: number | null;
  includedActiveListingLimit: number | null;
  overIncludedCap: boolean | null;
  policyRow: MarketBillingPolicyRow | null;
  entitlementRow: MarketListingEntitlementRow | null;
  priceRow: MarketOneOffPriceRow | null;
  amountMinor: number | null;
  currency: string | null;
  provider: MarketBillingProvider | null;
  runtimeActivationAllowed: boolean;
  checkoutEnabled: false;
  warnings: string[];
};

const ROLE_ORDER: Record<BillingRole | "__all__", number> = {
  __all__: 0,
  landlord: 10,
  agent: 20,
  tenant: 30,
};

const TIER_ORDER: Record<MarketPricingControlPlaneTier | "__all__", number> = {
  __all__: 0,
  free: 10,
  starter: 20,
  pro: 30,
  tenant_pro: 40,
  enterprise: 50,
};

function normalizeMarketCountry(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function normalizeBillingRole(value?: UserRole | BillingRole | null): BillingRole | null {
  return value === "tenant" || value === "landlord" || value === "agent" ? value : null;
}

function normalizeReadinessTier(
  role: BillingRole | null,
  rawTier?: string | null
): MarketPricingControlPlaneTier | null {
  if (!role) return null;

  const normalized = String(rawTier || "").trim().toLowerCase();
  if (normalized === "enterprise") {
    return role === "agent" ? "enterprise" : null;
  }

  if (role === "tenant") {
    return normalizeTenantPlanTier(normalized);
  }

  const tier = normalizePlanTier(normalized);
  if (tier === "tenant_pro") return null;
  return tier;
}

function normalizeActiveListingCount(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function findCanadaPolicyRow(rows: MarketBillingPolicyRow[]) {
  return (
    rows.find((row) => row.market_country === "CA" && row.active) ??
    rows.find((row) => row.market_country === "CA") ??
    null
  );
}

function findEntitlementRow(
  rows: MarketListingEntitlementRow[],
  role: BillingRole | null,
  tier: MarketPricingControlPlaneTier | null
) {
  if (!role || !tier || tier === "enterprise") return null;
  return (
    rows.find(
      (row) =>
        row.market_country === "CA" &&
        row.active &&
        row.role === role &&
        row.tier === tier
    ) ?? null
  );
}

function getPriceSpecificityScore(row: MarketOneOffPriceRow, role: BillingRole | null, tier: MarketPricingControlPlaneTier | null) {
  let score = 0;
  if (row.role && row.role === role) score += 100;
  if (!row.role) score += 10;
  if (row.tier && row.tier === tier) score += 1000;
  if (!row.tier) score += 10;
  if (row.active) score += 5;
  if (row.provider === "stripe") score += 3;
  if (row.currency === "CAD") score += 2;
  return score;
}

export function resolveCanadaRentalPaygPriceRow(input: {
  oneOffPrices: MarketOneOffPriceRow[];
  role: BillingRole | null;
  tier: MarketPricingControlPlaneTier | null;
}) {
  const candidates = input.oneOffPrices.filter((row) => {
    if (row.market_country !== "CA") return false;
    if (row.product_code !== "listing_submission") return false;
    if (row.role && row.role !== input.role) return false;
    if (row.tier && row.tier !== input.tier) return false;
    return true;
  });

  return (
    candidates
      .slice()
      .sort((a, b) => {
        const scoreDiff =
          getPriceSpecificityScore(b, input.role, input.tier) -
          getPriceSpecificityScore(a, input.role, input.tier);
        if (scoreDiff !== 0) return scoreDiff;
        const aRole = a.role ?? "__all__";
        const bRole = b.role ?? "__all__";
        if (aRole !== bRole) return ROLE_ORDER[aRole] - ROLE_ORDER[bRole];
        const aTier = a.tier ?? "__all__";
        const bTier = b.tier ?? "__all__";
        if (aTier !== bTier) return TIER_ORDER[aTier] - TIER_ORDER[bTier];
        return Date.parse(b.updated_at) - Date.parse(a.updated_at);
      })[0] ?? null
  );
}

function buildBlockedResult(
  input: Omit<
    CanadaRentalPaygReadinessResult,
    "status" | "eligible" | "reasonCode" | "blockers" | "runtimeActivationAllowed" | "checkoutEnabled" | "warnings"
  > & {
    blockers: CanadaRentalPaygReadinessBlocker[];
    reasonCode: CanadaRentalPaygReadinessReasonCode;
    status?: CanadaRentalPaygReadinessStatus;
    eligible?: boolean;
    warnings?: string[];
  }
): CanadaRentalPaygReadinessResult {
  return {
    status: input.status ?? "blocked",
    eligible: input.eligible ?? false,
    reasonCode: input.reasonCode,
    blockers: input.blockers,
    marketCountry: input.marketCountry,
    role: input.role,
    tier: input.tier,
    normalizedIntent: input.normalizedIntent,
    isShortlet: input.isShortlet,
    policyState: input.policyState,
    activeListingCount: input.activeListingCount,
    includedActiveListingLimit: input.includedActiveListingLimit,
    overIncludedCap: input.overIncludedCap,
    policyRow: input.policyRow,
    entitlementRow: input.entitlementRow,
    priceRow: input.priceRow,
    amountMinor: input.amountMinor,
    currency: input.currency,
    provider: input.provider,
    runtimeActivationAllowed: false,
    checkoutEnabled: false,
    warnings: input.warnings ?? [],
  };
}

export function resolveCanadaRentalPaygReadiness(
  input: CanadaRentalPaygReadinessInput
): CanadaRentalPaygReadinessResult {
  const marketCountry = normalizeMarketCountry(input.marketCountry);
  const normalizedRole = normalizeBillingRole(input.role);
  const normalizedTier = normalizeReadinessTier(normalizedRole, input.tier);
  const normalizedIntent = normalizeListingIntent(input.listingIntent);
  const activeListingCount = normalizeActiveListingCount(input.activeListingCount);
  const isShortlet = isShortletProperty({
    listing_intent: input.listingIntent,
    rental_type: input.rentalType,
  });

  const policyRow = findCanadaPolicyRow(input.policies);
  const policyState = policyRow?.policy_state ?? null;
  const entitlementRow = findEntitlementRow(input.entitlements, normalizedRole, normalizedTier);
  const priceRow = resolveCanadaRentalPaygPriceRow({
    oneOffPrices: input.oneOffPrices,
    role: normalizedRole,
    tier: normalizedTier,
  });
  const includedActiveListingLimit = entitlementRow?.active_listing_limit ?? null;
  const overIncludedCap =
    activeListingCount !== null && includedActiveListingLimit !== null
      ? activeListingCount >= includedActiveListingLimit
      : null;

  const shared = {
    marketCountry,
    role: normalizedRole,
    tier: normalizedTier,
    normalizedIntent,
    isShortlet,
    policyState,
    activeListingCount,
    includedActiveListingLimit,
    overIncludedCap,
    policyRow,
    entitlementRow,
    priceRow,
    amountMinor: priceRow?.amount_minor ?? null,
    currency: priceRow?.currency ?? null,
    provider: priceRow?.provider ?? null,
  };

  if (marketCountry !== "CA") {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "NON_CANADA_MARKET",
      blockers: ["NON_CANADA_MARKET"],
      warnings: ["Canada PAYG readiness only evaluates CA market rows."],
    });
  }

  if (!normalizedRole) {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "ROLE_NOT_SUPPORTED",
      blockers: ["ROLE_NOT_SUPPORTED"],
      warnings: ["Only landlord and agent supply-side roles are currently in scope for Canada PAYG planning."],
    });
  }

  if (normalizedRole === "tenant") {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "TENANT_DEMAND_ONLY",
      blockers: ["TENANT_DEMAND_ONLY"],
      warnings: ["Tenant remains demand-side only in the Canada PAYG pilot policy."],
    });
  }

  if (isShortlet) {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "SHORTLET_EXCLUDED",
      blockers: ["SHORTLET_EXCLUDED"],
      warnings: ["Canada PAYG pilot scope excludes shortlets."],
    });
  }

  if (normalizedIntent === "sale") {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "SALE_DEFERRED",
      blockers: ["SALE_DEFERRED"],
      warnings: ["Canada sales monetisation remains deferred outside the first rental PAYG pilot."],
    });
  }

  if (normalizedIntent === "off_plan") {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "OFF_PLAN_DEFERRED",
      blockers: ["OFF_PLAN_DEFERRED"],
      warnings: ["Canada off-plan monetisation remains deferred outside the first rental PAYG pilot."],
    });
  }

  if (!normalizedIntent || !isRentIntent(normalizedIntent) || isSaleIntent(normalizedIntent)) {
    return buildBlockedResult({
      ...shared,
      status: "not_applicable",
      reasonCode: "NON_RENTAL_LISTING",
      blockers: ["NON_RENTAL_LISTING"],
      warnings: ["Canada PAYG readiness only applies to rental listing submissions."],
    });
  }

  if (normalizedTier === "enterprise") {
    return buildBlockedResult({
      ...shared,
      status: "planning_only",
      reasonCode: "ENTERPRISE_PLANNING_ONLY",
      blockers: ["ENTERPRISE_PLANNING_ONLY"],
      warnings: ["Enterprise remains planning-only until separate runtime tier support is implemented."],
    });
  }

  const blockers: CanadaRentalPaygReadinessBlocker[] = [];
  const warnings = [
    "Canada PAYG runtime remains legacy-backed in production.",
    "Checkout is intentionally disabled in this batch even when runtime activation prerequisites are satisfied.",
  ];

  if (!policyRow) {
    blockers.push("POLICY_ROW_MISSING");
  } else {
    if (policyRow.policy_state !== "approved" && policyRow.policy_state !== "live") {
      blockers.push("POLICY_STATE_NOT_READY");
      warnings.push(`Canada market policy is ${policyRow.policy_state}; runtime activation requires approved or live.`);
    }
    if (!policyRow.rental_enabled) {
      blockers.push("RENTAL_LANE_DISABLED");
    }
    if (!policyRow.payg_listing_enabled) {
      blockers.push("PAYG_POLICY_DISABLED");
    }
    if (policyRow.listing_payg_provider !== "stripe") {
      blockers.push("POLICY_PROVIDER_NOT_STRIPE");
    }
    if (policyRow.currency !== "CAD") {
      blockers.push("POLICY_CURRENCY_NOT_CAD");
    }
  }

  if (!entitlementRow) {
    blockers.push("ENTITLEMENT_ROW_MISSING");
  } else {
    if (!entitlementRow.payg_beyond_cap_enabled) {
      blockers.push("BEYOND_CAP_NOT_ENABLED");
    }
  }

  if (overIncludedCap === false) {
    return buildBlockedResult({
      ...shared,
      status: "not_needed",
      eligible: blockers.length === 0,
      reasonCode: "UNDER_INCLUDED_CAP",
      blockers,
      warnings: [...warnings, "Listing is still within the included active cap, so Canada beyond-cap PAYG is not required."],
    });
  }

  if (!priceRow) {
    blockers.push("PRICE_ROW_MISSING");
  } else {
    if (!priceRow.active) {
      blockers.push("PRICE_ROW_INACTIVE");
    }
    if (!priceRow.enabled) {
      blockers.push("PRICE_ROW_DISABLED");
    }
    if (priceRow.provider !== "stripe") {
      blockers.push("PRICE_PROVIDER_NOT_STRIPE");
    }
    if (priceRow.currency !== "CAD") {
      blockers.push("PRICE_CURRENCY_NOT_CAD");
    }
  }

  if (blockers.length > 0) {
    const reasonCode = blockers[0] ?? "CHECKOUT_DISABLED_IN_THIS_BATCH";
    return buildBlockedResult({
      ...shared,
      eligible: Boolean(priceRow && normalizedRole && normalizedTier),
      reasonCode,
      blockers,
      warnings,
    });
  }

  return {
    status: "ready",
    eligible: true,
    reasonCode: "READY_FOR_RUNTIME_INTEGRATION",
    blockers: [],
    ...shared,
    runtimeActivationAllowed: true,
    checkoutEnabled: false,
    warnings,
  };
}
