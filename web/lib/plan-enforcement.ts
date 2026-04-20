import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanForTier,
  isPlanExpired,
  resolveEffectivePlanTier,
  type PlanGate,
} from "@/lib/plans";

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
