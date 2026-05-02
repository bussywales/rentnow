import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DeliveryMonitorMergedItem,
  DeliveryMonitorNoteRow,
  DeliveryMonitorStateOverrideRow,
  DeliveryMonitorTestRunRow,
} from "@/lib/admin/delivery-monitor";
import { mergeDeliveryMonitorItems, resolveDeliveryMonitorItem } from "@/lib/admin/delivery-monitor";

type MinimalSupabase = Pick<SupabaseClient, "from">;

export async function loadDeliveryMonitorBoard(supabase: MinimalSupabase) {
  const [overridesResult, testRunsResult, notesResult] = await Promise.all([
    supabase
      .from("delivery_monitor_state_overrides")
      .select("item_key,status,updated_by,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("delivery_monitor_test_runs")
      .select("id,item_key,testing_status,tester_name,notes,tested_at,created_by,created_at")
      .order("tested_at", { ascending: false }),
    supabase
      .from("delivery_monitor_notes")
      .select("id,item_key,body,author_name,created_by,created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (overridesResult.error) {
    throw new Error(overridesResult.error.message || "Unable to load delivery monitor status overrides.");
  }
  if (testRunsResult.error) {
    throw new Error(testRunsResult.error.message || "Unable to load delivery monitor test runs.");
  }
  if (notesResult.error) {
    throw new Error(notesResult.error.message || "Unable to load delivery monitor notes.");
  }

  return mergeDeliveryMonitorItems({
    statusOverrides: (overridesResult.data ?? []) as DeliveryMonitorStateOverrideRow[],
    testRuns: (testRunsResult.data ?? []) as DeliveryMonitorTestRunRow[],
    notes: (notesResult.data ?? []) as DeliveryMonitorNoteRow[],
  });
}

export async function loadDeliveryMonitorItem(
  supabase: MinimalSupabase,
  itemKey: string
): Promise<DeliveryMonitorMergedItem | null> {
  if (!resolveDeliveryMonitorItem(itemKey)) return null;
  const board = await loadDeliveryMonitorBoard(supabase);
  return board.find((item) => item.key === itemKey) ?? null;
}

export async function resolveAdminActorName(
  supabase: MinimalSupabase,
  userId: string,
  emailFallback?: string | null
) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : "";
  if (fullName) return fullName;
  if (emailFallback && emailFallback.trim()) return emailFallback.trim();
  return `Admin ${userId.slice(0, 8)}`;
}
