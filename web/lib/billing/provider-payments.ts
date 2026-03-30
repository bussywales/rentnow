import { normalizePlanTier, type PlanTier } from "@/lib/plans";
import { normalizeCurrency } from "@/lib/currencies";

export type ProviderName = "paystack" | "flutterwave";
export type BillingCadence = "monthly" | "yearly";

export type ProviderPricing = {
  currency: string;
  amountMajor: number;
  amountMinor: number;
  requestedCurrency: string;
  resolutionKey: string;
};

export type ProviderPlanDecision = {
  planTier: PlanTier;
  validUntil: string | null;
  skipped: boolean;
  skipReason?: string | null;
};

type PricingInput = {
  provider: ProviderName;
  role: "landlord" | "agent" | "tenant" | "admin";
  tier: PlanTier;
  cadence: BillingCadence;
  currency?: string | null;
};

const PROVIDER_PRICING: Record<
  ProviderName,
  Record<string, Record<string, Record<BillingCadence, number>>>
> = {
  paystack: {
    NGN: {
      landlord: { monthly: 2900, yearly: 29000 },
      agent: { monthly: 4900, yearly: 49000 },
      tenant: { monthly: 900, yearly: 9000 },
    },
  },
  flutterwave: {
    NGN: {
      landlord: { monthly: 2900, yearly: 29000 },
      agent: { monthly: 4900, yearly: 49000 },
      tenant: { monthly: 900, yearly: 9000 },
    },
  },
};

export function normalizeCadence(value?: string | null): BillingCadence {
  return value === "yearly" ? "yearly" : "monthly";
}

export function resolveProviderPricing(input: PricingInput): ProviderPricing | null {
  const cadence = input.cadence;
  const role = input.role === "admin" ? "landlord" : input.role;
  const requestedCurrency = normalizeCurrency(input.currency ?? null) ?? "NGN";
  const providerPricing = PROVIDER_PRICING[input.provider];
  const pricesForCurrency = providerPricing[requestedCurrency];
  if (!pricesForCurrency) return null;
  const rolePrices = pricesForCurrency[role] || pricesForCurrency.landlord;
  const amountMajor = rolePrices[cadence];
  const amountMinor = Math.round(amountMajor * 100);

  return {
    currency: requestedCurrency,
    amountMajor,
    amountMinor,
    requestedCurrency,
    resolutionKey: `${input.provider.toUpperCase()}_${role.toUpperCase()}_${cadence.toUpperCase()}_${requestedCurrency}`,
  };
}

export function computeValidUntil(cadence: BillingCadence, now = new Date()): string {
  const next = new Date(now.getTime());
  if (cadence === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}

export function computeProviderPlanUpdate(
  planTier: PlanTier,
  validUntil: string | null,
  existingPlan?: { billing_source?: string | null; plan_tier?: string | null; valid_until?: string | null } | null
): ProviderPlanDecision {
  if (existingPlan?.billing_source === "manual") {
    return {
      planTier: normalizePlanTier(existingPlan.plan_tier ?? "free"),
      validUntil: existingPlan.valid_until ?? null,
      skipped: true,
      skipReason: "manual_override",
    };
  }

  return {
    planTier,
    validUntil,
    skipped: false,
    skipReason: null,
  };
}

export function isProviderEventProcessed(event: {
  status?: string | null;
  processed_at?: string | null;
}): boolean {
  if (!event.processed_at) return false;
  return event.status === "verified" || event.status === "skipped";
}

export function resolveTierForRole(role: string, tier: PlanTier): PlanTier | null {
  if (role === "tenant") {
    return tier === "tenant_pro" ? "tenant_pro" : null;
  }
  if (role === "landlord" || role === "agent" || role === "admin") {
    return tier === "starter" || tier === "pro" ? tier : null;
  }
  return null;
}
