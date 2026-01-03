import { getTenantPlanForTier } from "@/lib/plans";

type EarlyAccessInput = {
  role: string | null;
  hasUser: boolean;
  planTier: string | null;
  validUntil: string | null;
  earlyAccessMinutes: number;
  now?: number;
};

export function getEarlyAccessApprovedBefore({
  role,
  hasUser,
  planTier,
  validUntil,
  earlyAccessMinutes,
  now = Date.now(),
}: EarlyAccessInput) {
  if (earlyAccessMinutes <= 0) {
    return { approvedBefore: null, isTenantPro: false };
  }

  let applyDelay = !hasUser;
  let isTenantPro = false;

  if (hasUser) {
    if (role === "tenant") {
      const expired =
        !!validUntil &&
        Number.isFinite(Date.parse(validUntil)) &&
        Date.parse(validUntil) < now;
      const tenantPlan = getTenantPlanForTier(expired ? "free" : planTier ?? "free");
      isTenantPro = tenantPlan.tier === "tenant_pro";
      applyDelay = !isTenantPro;
    } else if (role) {
      applyDelay = false;
    }
  }

  const approvedBefore = applyDelay
    ? new Date(now - earlyAccessMinutes * 60 * 1000).toISOString()
    : null;

  return { approvedBefore, isTenantPro };
}
