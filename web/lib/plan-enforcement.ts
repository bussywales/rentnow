import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanForTier, type PlanGate } from "@/lib/plans";

type PlanUsage = {
  plan: PlanGate;
  activeCount: number;
  source: "service" | "rls" | "default";
  error?: string;
};

type UsageInput = {
  supabase: SupabaseClient;
  ownerId: string;
  serviceClient?: SupabaseClient | null;
  excludeId?: string | null;
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
    .select("plan_tier, max_listings_override")
    .eq("profile_id", ownerId)
    .maybeSingle();

  const plan = getPlanForTier(
    planRow?.plan_tier ?? "free",
    planRow?.max_listings_override ?? null
  );

  if (planError) {
    return {
      plan,
      activeCount: 0,
      source,
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
      error: countError.message,
    };
  }

  return {
    plan,
    activeCount: count ?? 0,
    source,
  };
}
