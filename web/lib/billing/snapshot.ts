import { isPlanExpired, normalizePlanTier } from "@/lib/plans";
import { maskIdentifier } from "@/lib/billing/mask";

export type BillingPlanRow = {
  profile_id?: string | null;
  plan_tier?: string | null;
  billing_source?: string | null;
  valid_until?: string | null;
  stripe_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_current_period_end?: string | null;
  updated_at?: string | null;
  upgraded_at?: string | null;
  updated_by?: string | null;
  upgraded_by?: string | null;
};

export type BillingNotesRow = {
  billing_notes?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type BillingSnapshot = {
  profileId: string;
  email: string | null;
  role: string | null;
  fullName: string | null;
  planTier: string;
  billingSource: string;
  validUntil: string | null;
  isExpired: boolean;
  stripeStatus: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeCurrentPeriodEnd: string | null;
  updatedAt: string | null;
  upgradedAt: string | null;
  updatedBy: string;
  upgradedBy: string;
  billingNotes: string | null;
  billingNotesUpdatedAt: string | null;
  billingNotesUpdatedBy: string;
};

export function buildBillingSnapshot(input: {
  profileId: string;
  email?: string | null;
  role?: string | null;
  fullName?: string | null;
  plan?: BillingPlanRow | null;
  notes?: BillingNotesRow | null;
}): BillingSnapshot {
  const plan = input.plan ?? null;
  const planTier = normalizePlanTier(plan?.plan_tier ?? "free");
  const validUntil = plan?.valid_until ?? null;
  const billingSource = plan?.billing_source ?? "manual";

  return {
    profileId: input.profileId,
    email: input.email ?? null,
    role: input.role ?? null,
    fullName: input.fullName ?? null,
    planTier,
    billingSource,
    validUntil,
    isExpired: isPlanExpired(validUntil),
    stripeStatus: plan?.stripe_status ?? null,
    stripeCustomerId: maskIdentifier(plan?.stripe_customer_id ?? null),
    stripeSubscriptionId: maskIdentifier(plan?.stripe_subscription_id ?? null),
    stripePriceId: maskIdentifier(plan?.stripe_price_id ?? null),
    stripeCurrentPeriodEnd: plan?.stripe_current_period_end ?? null,
    updatedAt: plan?.updated_at ?? null,
    upgradedAt: plan?.upgraded_at ?? null,
    updatedBy: maskIdentifier(plan?.updated_by ?? null),
    upgradedBy: maskIdentifier(plan?.upgraded_by ?? null),
    billingNotes: input.notes?.billing_notes ?? null,
    billingNotesUpdatedAt: input.notes?.updated_at ?? null,
    billingNotesUpdatedBy: maskIdentifier(input.notes?.updated_by ?? null),
  };
}
