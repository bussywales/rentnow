import { normalizePlanTier, type PlanTier } from "@/lib/plans";

export type StripePlanUpdateInput = {
  tier: PlanTier | string;
  status: string | null;
  currentPeriodEnd: string | null;
  allowImmediateDowngrade?: boolean;
};

export type ExistingPlanSnapshot = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
};

export type StripePlanUpdateDecision = {
  planTier: PlanTier;
  validUntil: string | null;
  skipped: boolean;
  skipReason: "manual_override" | null;
};

export function computeStripePlanUpdate(
  input: StripePlanUpdateInput,
  existingPlan?: ExistingPlanSnapshot | null
): StripePlanUpdateDecision {
  if (existingPlan?.billing_source === "manual") {
    return {
      planTier: normalizePlanTier(existingPlan.plan_tier),
      validUntil: existingPlan.valid_until ?? null,
      skipped: true,
      skipReason: "manual_override",
    };
  }

  const normalizedTier = normalizePlanTier(input.tier);
  const status = input.status ?? "";
  const isExpired =
    !!input.currentPeriodEnd &&
    Number.isFinite(Date.parse(input.currentPeriodEnd)) &&
    Date.parse(input.currentPeriodEnd) <= Date.now();
  const immediateStatus =
    status === "canceled" || status === "incomplete_expired" || status === "ended";
  const shouldDowngrade =
    !!input.allowImmediateDowngrade || immediateStatus || isExpired;

  return {
    planTier: shouldDowngrade ? "free" : normalizedTier,
    validUntil: shouldDowngrade ? null : input.currentPeriodEnd,
    skipped: false,
    skipReason: null,
  };
}
