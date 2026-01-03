import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasActiveDelegation(
  supabase: SupabaseClient,
  agentId: string,
  landlordId: string
): Promise<boolean> {
  if (!agentId || !landlordId) return false;
  const { data, error } = await supabase
    .from("agent_delegations")
    .select("id")
    .eq("agent_id", agentId)
    .eq("landlord_id", landlordId)
    .eq("status", "active")
    .maybeSingle();
  if (error) return false;
  return !!data;
}
