import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanForTier,
  isPlanExpired,
  resolveEffectivePlanTier,
  type PlanGate,
} from "@/lib/plans";
import {
  resolveListingBillingUrl,
  type ListingMonetizationContext,
} from "@/lib/billing/listing-publish-entitlement.server";
import { buildHostPropertyEditHref } from "@/lib/routing/dashboard-properties-legacy";
import type { UserRole } from "@/lib/types";

type PlanUsage = {
  plan: PlanGate;
  activeCount: number;
  source: "service" | "rls" | "default";
  validUntil?: string | null;
  expired?: boolean;
  error?: string;
};

type UsageInput = {
  supabase: SupabaseClient;
  ownerId: string;
  serviceClient?: SupabaseClient | null;
  excludeId?: string | null;
};

export type ActiveListingLimitGateResult =
  | {
      ok: true;
      usage: PlanUsage;
    }
  | {
      ok: false;
      usage: PlanUsage;
      error: string;
      code: "plan_limit_reached";
      maxListings: number;
      activeCount: number;
      planTier: PlanGate["tier"];
    };

export type ActiveListingLimitRecoveryPayload = {
  error: string;
  code: "plan_limit_reached";
  reason: "LISTING_LIMIT_REACHED";
  maxListings: number;
  activeCount: number;
  planTier: PlanGate["tier"];
  planName: string;
  headline: string;
  detail: string;
  billingUrl: string;
  manageUrl: string;
  resumeUrl?: string;
};

type BuildActiveListingLimitRecoveryInput = {
  gate: Extract<ActiveListingLimitGateResult, { ok: false }>;
  requesterRole?: UserRole | null;
  context: ListingMonetizationContext;
  propertyId?: string | null;
  manageUrl?: string;
};

export async function getPlanUsage({
  supabase,
  ownerId,
  serviceClient,
  excludeId,
}: UsageInput): Promise<PlanUsage> {
  const client = serviceClient ?? supabase;
  const source = serviceClient ? "service" : "rls";
  const { data: planRow, error: planError } = await client
    .from("profile_plans")
    .select("plan_tier, max_listings_override, valid_until")
    .eq("profile_id", ownerId)
    .maybeSingle();

  const validUntil = planRow?.valid_until ?? null;
  const expired = isPlanExpired(validUntil);
  const effectivePlanTier = resolveEffectivePlanTier(planRow?.plan_tier ?? "free", validUntil);
  const plan = getPlanForTier(
    effectivePlanTier,
    effectivePlanTier === "free" ? null : planRow?.max_listings_override ?? null
  );

  if (planError) {
    return {
      plan,
      activeCount: 0,
      source,
      validUntil,
      expired,
      error: planError.message,
    };
  }

  let countQuery = client
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  if (excludeId) {
    countQuery = countQuery.neq("id", excludeId);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    return {
      plan,
      activeCount: 0,
      source,
      validUntil,
      expired,
      error: countError.message,
    };
  }

  return {
    plan,
    activeCount: count ?? 0,
    source,
    validUntil,
    expired,
  };
}

export async function enforceActiveListingLimit(
  input: UsageInput
): Promise<ActiveListingLimitGateResult> {
  const usage = await getPlanUsage(input);

  if (usage.error) {
    return {
      ok: false,
      usage,
      error: usage.error,
      code: "plan_limit_reached",
      maxListings: usage.plan.maxListings,
      activeCount: usage.activeCount,
      planTier: usage.plan.tier,
    };
  }

  if (usage.activeCount >= usage.plan.maxListings) {
    return {
      ok: false,
      usage,
      error: "Plan limit reached",
      code: "plan_limit_reached",
      maxListings: usage.plan.maxListings,
      activeCount: usage.activeCount,
      planTier: usage.plan.tier,
    };
  }

  return { ok: true, usage };
}

function resolveActiveListingLimitActionLabel(context: ListingMonetizationContext) {
  if (context === "renewal") return "renew this listing";
  if (context === "reactivation") return "reactivate this listing";
  return "continue with this listing";
}

export function buildActiveListingLimitRecoveryPayload({
  gate,
  requesterRole,
  context,
  propertyId,
  manageUrl,
}: BuildActiveListingLimitRecoveryInput): ActiveListingLimitRecoveryPayload {
  const billingUrl = resolveListingBillingUrl(requesterRole);
  const normalizedManageUrl =
    manageUrl ??
    (requesterRole === "admin"
      ? "/admin/listings"
      : requesterRole === "tenant"
        ? "/tenant"
        : "/host/listings?view=manage");
  const actionLabel = resolveActiveListingLimitActionLabel(context);
  const resumeUrl = propertyId
    ? (() => {
        const params = new URLSearchParams({
          step: "submit",
          monetization: "listing_limit",
          monetization_context: context,
          active_count: String(gate.activeCount),
          max_listings: String(gate.maxListings),
          plan_tier: gate.planTier,
          plan_name: gate.usage.plan.name,
        });
        return buildHostPropertyEditHref(propertyId, Object.fromEntries(params.entries()));
      })()
    : undefined;

  return {
    error: "You've reached your active listing limit.",
    code: "plan_limit_reached",
    reason: "LISTING_LIMIT_REACHED",
    maxListings: gate.maxListings,
    activeCount: gate.activeCount,
    planTier: gate.planTier,
    planName: gate.usage.plan.name,
    headline: "You've reached your active listing limit",
    detail: `You already have ${gate.activeCount} active listings out of ${gate.maxListings} on ${gate.usage.plan.name}. Upgrade your plan or manage active listings to ${actionLabel}.`,
    billingUrl,
    manageUrl: normalizedManageUrl,
    ...(resumeUrl ? { resumeUrl } : {}),
  };
}
