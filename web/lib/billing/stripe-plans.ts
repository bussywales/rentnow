import { getPlanForTier, normalizePlanTier, type PlanGate, type PlanTier } from "@/lib/plans";
import type { ProviderMode } from "@/lib/billing/provider-settings";
import type { UserRole } from "@/lib/types";
import { normalizeCurrency } from "@/lib/currencies";

export type BillingCadence = "monthly" | "yearly";
export type BillingRole = "landlord" | "agent" | "tenant";

export type StripePlanDescriptor = {
  role: BillingRole;
  tier: PlanTier;
  cadence: BillingCadence;
  priceId: string;
  currency?: string | null;
};

const ROLE_PAID_TIERS: Record<BillingRole, PlanTier[]> = {
  landlord: ["starter", "pro"],
  agent: ["starter", "pro"],
  tenant: ["tenant_pro"],
};

function normalizeRole(role: UserRole): BillingRole | null {
  if (role === "landlord" || role === "agent" || role === "tenant") return role;
  return null;
}

function basePriceKey(role: BillingRole, cadence: BillingCadence) {
  return `STRIPE_PRICE_${role.toUpperCase()}_${cadence.toUpperCase()}`;
}

function tierPriceKey(role: BillingRole, tier: PlanTier, cadence: BillingCadence) {
  return `STRIPE_PRICE_${role.toUpperCase()}_${tier.toUpperCase()}_${cadence.toUpperCase()}`;
}

function currencyBasePriceKey(role: BillingRole, cadence: BillingCadence, currency: string) {
  return `${basePriceKey(role, cadence)}_${currency.toUpperCase()}`;
}

function currencyTierPriceKey(role: BillingRole, tier: PlanTier, cadence: BillingCadence, currency: string) {
  return `${tierPriceKey(role, tier, cadence)}_${currency.toUpperCase()}`;
}

function resolveEnvValue(key: string, mode?: ProviderMode | null) {
  const modeSuffix = mode ? `_${mode.toUpperCase()}` : "";
  const modeValue = modeSuffix ? process.env[`${key}${modeSuffix}`] : null;
  return {
    key: modeValue ? `${key}${modeSuffix}` : process.env[key] ? key : null,
    value: modeValue || process.env[key] || null,
  };
}

export function resolveStripePriceSelection(
  role: BillingRole,
  tier: PlanTier,
  cadence: BillingCadence,
  mode?: ProviderMode | null,
  currency?: string | null
) {
  const normalizedCurrency = normalizeCurrency(currency ?? null);
  const candidateKeys = normalizedCurrency
    ? [
        currencyTierPriceKey(role, tier, cadence, normalizedCurrency),
        currencyBasePriceKey(role, cadence, normalizedCurrency),
        tierPriceKey(role, tier, cadence),
        basePriceKey(role, cadence),
      ]
    : [tierPriceKey(role, tier, cadence), basePriceKey(role, cadence)];

  for (const candidateKey of candidateKeys) {
    const resolved = resolveEnvValue(candidateKey, mode);
    if (resolved.value) {
      return {
        priceId: resolved.value,
        envKey: resolved.key,
      };
    }
  }

  return {
    priceId: null,
    envKey: null,
  };
}

export function getStripePriceId(input: {
  role: UserRole;
  tier: PlanTier;
  cadence: BillingCadence;
  mode?: ProviderMode | null;
  currency?: string | null;
}): string | null {
  const role = normalizeRole(input.role);
  if (!role) return null;
  const tier = normalizePlanTier(input.tier);
  const allowedTiers = ROLE_PAID_TIERS[role];
  if (!allowedTiers.includes(tier)) return null;
  return resolveStripePriceSelection(role, tier, input.cadence, input.mode, input.currency).priceId;
}

function parseStripePriceEnvKey(key: string) {
  const match = key.match(
    /^STRIPE_PRICE_(LANDLORD|AGENT|TENANT)(?:_(STARTER|PRO|TENANT_PRO))?_(MONTHLY|YEARLY)(?:_([A-Z]{3}))?(?:_(TEST|LIVE))?$/
  );
  if (!match) return null;
  const role = match[1].toLowerCase() as BillingRole;
  const tier = normalizePlanTier((match[2] || (role === "tenant" ? "tenant_pro" : "starter")).toLowerCase());
  const cadence = match[3].toLowerCase() as BillingCadence;
  const currency = match[4] || null;
  return { role, tier, cadence, currency };
}

export function listStripePlans(): StripePlanDescriptor[] {
  const plans: StripePlanDescriptor[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    const parsed = parseStripePriceEnvKey(key);
    if (!parsed) continue;
    if (!plans.find((plan) => plan.priceId === value)) {
      plans.push({
        role: parsed.role,
        tier: parsed.tier,
        cadence: parsed.cadence,
        priceId: value,
        currency: parsed.currency,
      });
    }
  }

  return plans;
}

export function getStripePlanByPriceId(priceId: string): StripePlanDescriptor | null {
  const match = listStripePlans().find((plan) => plan.priceId === priceId);
  return match || null;
}

export function getStripePlanGate(tier: PlanTier, maxOverride?: number | null): PlanGate {
  return getPlanForTier(tier, maxOverride ?? null);
}
