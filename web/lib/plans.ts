export type PlanTier = "free" | "starter" | "pro" | "tenant_pro";

export type PlanGate = {
  name: string;
  tier: PlanTier;
  maxListings: number;
  featuredListing: boolean;
  instantApproval: boolean;
};

export type TenantPlanTier = "free" | "tenant_pro";

export type TenantPlanGate = {
  name: string;
  tier: TenantPlanTier;
  maxSavedSearches: number | null;
  instantAlerts: boolean;
  earlyAccessMinutes: number;
};

const PLAN_DEFINITIONS: Record<PlanTier, PlanGate> = {
  free: {
    name: "Free",
    tier: "free",
    maxListings: 1,
    featuredListing: false,
    instantApproval: false,
  },
  starter: {
    name: "Starter",
    tier: "starter",
    maxListings: 3,
    featuredListing: false,
    instantApproval: false,
  },
  pro: {
    name: "Pro",
    tier: "pro",
    maxListings: 10,
    featuredListing: true,
    instantApproval: false,
  },
  tenant_pro: {
    name: "Tenant Pro",
    tier: "tenant_pro",
    maxListings: 1,
    featuredListing: false,
    instantApproval: false,
  },
};

const TENANT_PLAN_DEFINITIONS: Record<TenantPlanTier, TenantPlanGate> = {
  free: {
    name: "Free",
    tier: "free",
    maxSavedSearches: 3,
    instantAlerts: false,
    earlyAccessMinutes: 0,
  },
  tenant_pro: {
    name: "Tenant Pro",
    tier: "tenant_pro",
    maxSavedSearches: null,
    instantAlerts: true,
    earlyAccessMinutes: 60,
  },
};

export function normalizePlanTier(tier?: string | null): PlanTier {
  if (tier === "starter" || tier === "pro" || tier === "tenant_pro") return tier;
  return "free";
}

export function getPlanForTier(
  tier?: string | null,
  maxOverride?: number | null
): PlanGate {
  const normalized = normalizePlanTier(tier);
  const base = PLAN_DEFINITIONS[normalized];
  const override =
    typeof maxOverride === "number" && Number.isFinite(maxOverride) && maxOverride > 0
      ? maxOverride
      : null;
  if (!override) return base;
  return { ...base, maxListings: Math.max(1, Math.floor(override)) };
}

export function normalizeTenantPlanTier(tier?: string | null): TenantPlanTier {
  if (tier === "tenant_pro") return "tenant_pro";
  return "free";
}

export function getTenantPlanForTier(tier?: string | null): TenantPlanGate {
  const normalized = normalizeTenantPlanTier(tier);
  return TENANT_PLAN_DEFINITIONS[normalized];
}

export function isSavedSearchLimitReached(count: number, plan: TenantPlanGate | null) {
  if (!plan || plan.maxSavedSearches === null) return false;
  return count >= plan.maxSavedSearches;
}

export function getPlanForRole(role?: string | null): PlanGate | null {
  if (!role) return null;
  if (role === "admin" || role === "tenant") return null;
  return getPlanForTier("free");
}

export function isListingLimitReached(count: number, plan: PlanGate | null) {
  if (!plan) return false;
  return count >= plan.maxListings;
}
