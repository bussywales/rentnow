import { getPlanForTier, normalizePlanTier, type PlanGate, type PlanTier } from "@/lib/plans";
import type { UserRole } from "@/lib/types";

export type BillingCadence = "monthly" | "yearly";
export type BillingRole = "landlord" | "agent";

export type StripePlanDescriptor = {
  role: BillingRole;
  tier: PlanTier;
  cadence: BillingCadence;
  priceId: string;
};

const PAID_TIERS: PlanTier[] = ["starter", "pro"];

function normalizeRole(role: UserRole): BillingRole | null {
  if (role === "landlord" || role === "agent") return role;
  return null;
}

function basePriceKey(role: BillingRole, cadence: BillingCadence) {
  return `STRIPE_PRICE_${role.toUpperCase()}_${cadence.toUpperCase()}`;
}

function tierPriceKey(role: BillingRole, tier: PlanTier, cadence: BillingCadence) {
  return `STRIPE_PRICE_${role.toUpperCase()}_${tier.toUpperCase()}_${cadence.toUpperCase()}`;
}

function resolvePriceId(role: BillingRole, tier: PlanTier, cadence: BillingCadence) {
  const tierKey = tierPriceKey(role, tier, cadence);
  const tierValue = process.env[tierKey];
  if (tierValue) return tierValue;

  const baseKey = basePriceKey(role, cadence);
  return process.env[baseKey] || null;
}

export function getStripePriceId(input: {
  role: UserRole;
  tier: PlanTier;
  cadence: BillingCadence;
}): string | null {
  const role = normalizeRole(input.role);
  if (!role) return null;
  const tier = normalizePlanTier(input.tier);
  if (!PAID_TIERS.includes(tier)) return null;
  return resolvePriceId(role, tier, input.cadence);
}

export function listStripePlans(): StripePlanDescriptor[] {
  const roles: BillingRole[] = ["landlord", "agent"];
  const cadences: BillingCadence[] = ["monthly", "yearly"];
  const plans: StripePlanDescriptor[] = [];

  roles.forEach((role) => {
    PAID_TIERS.forEach((tier) => {
      cadences.forEach((cadence) => {
        const priceId = resolvePriceId(role, tier, cadence);
        if (priceId) {
          plans.push({ role, tier, cadence, priceId });
        }
      });
    });
  });

  return plans;
}

export function getStripePlanByPriceId(priceId: string): StripePlanDescriptor | null {
  const match = listStripePlans().find((plan) => plan.priceId === priceId);
  return match || null;
}

export function getStripePlanGate(tier: PlanTier, maxOverride?: number | null): PlanGate {
  return getPlanForTier(tier, maxOverride ?? null);
}
