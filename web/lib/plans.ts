export type PlanTier = "free" | "starter" | "pro";

export type PlanGate = {
  name: string;
  tier: PlanTier;
  maxListings: number;
  featuredListing: boolean;
  instantApproval: boolean;
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
};

export function normalizePlanTier(tier?: string | null): PlanTier {
  if (tier === "starter" || tier === "pro") return tier;
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

export function getPlanForRole(role?: string | null): PlanGate | null {
  if (!role) return null;
  if (role === "admin" || role === "tenant") return null;
  return getPlanForTier("free");
}

export function isListingLimitReached(count: number, plan: PlanGate | null) {
  if (!plan) return false;
  return count >= plan.maxListings;
}
