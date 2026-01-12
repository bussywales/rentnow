import type { SupabaseClient } from "@supabase/supabase-js";

export type PushDeliveryAttemptRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  kind: string;
  status: "attempted" | "delivered" | "failed" | "skipped" | "blocked";
  reason_code: string | null;
  delivered_count: number;
  failed_count: number;
  blocked_count: number;
  skipped_count: number;
  meta?: Record<string, unknown> | null;
};

export type PushDeliverySummary = {
  attempted: number;
  delivered: number;
  blocked: number;
  skipped: number;
  failed: number;
};

export type PushDeliveryInsert = {
  actorUserId: string | null;
  kind: string;
  status: PushDeliveryAttemptRow["status"];
  reasonCode?: string | null;
  deliveredCount?: number;
  failedCount?: number;
  blockedCount?: number;
  skippedCount?: number;
  windowSeconds?: number | null;
  meta?: Record<string, unknown> | null;
};

export function buildPushDeliverySummary(
  rows: PushDeliveryAttemptRow[]
): PushDeliverySummary {
  return rows.reduce<PushDeliverySummary>(
    (acc, row) => {
      if (row.status === "attempted") acc.attempted += 1;
      if (row.status === "delivered") acc.delivered += 1;
      if (row.status === "blocked") acc.blocked += 1;
      if (row.status === "skipped") acc.skipped += 1;
      if (row.status === "failed") acc.failed += 1;
      return acc;
    },
    { attempted: 0, delivered: 0, blocked: 0, skipped: 0, failed: 0 }
  );
}

export async function insertPushDeliveryAttempt(
  adminDb: SupabaseClient,
  input: PushDeliveryInsert
) {
  await adminDb.from("push_delivery_attempts").insert({
    actor_user_id: input.actorUserId,
    kind: input.kind,
    status: input.status,
    reason_code: input.reasonCode ?? null,
    delivered_count: input.deliveredCount ?? 0,
    failed_count: input.failedCount ?? 0,
    blocked_count: input.blockedCount ?? 0,
    skipped_count: input.skippedCount ?? 0,
    window_seconds: input.windowSeconds ?? null,
    meta: input.meta ?? null,
  });
}

export async function fetchPushDeliveryAttempts(
  adminDb: SupabaseClient,
  limit = 20
): Promise<{ rows: PushDeliveryAttemptRow[]; error: string | null }> {
  const { data, error } = await adminDb
    .from("push_delivery_attempts")
    .select(
      "id, created_at, actor_user_id, kind, status, reason_code, delivered_count, failed_count, blocked_count, skipped_count, meta"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data as PushDeliveryAttemptRow[]) ?? [], error: null };
}

export type TenantPushDeliverySummary = {
  last24h: number;
  last7d: number;
  recent: PushDeliveryAttemptRow[];
  error: string | null;
};

export async function fetchTenantPushDeliverySummary(
  adminDb: SupabaseClient,
  limit = 10
): Promise<TenantPushDeliverySummary> {
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [last24hResult, last7dResult, recentResult] = await Promise.all([
    adminDb
      .from("push_delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("kind", "tenant_saved_search")
      .gte("created_at", last24h),
    adminDb
      .from("push_delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("kind", "tenant_saved_search")
      .gte("created_at", last7d),
    adminDb
      .from("push_delivery_attempts")
      .select(
        "id, created_at, actor_user_id, kind, status, reason_code, delivered_count, failed_count, blocked_count, skipped_count, meta"
      )
      .eq("kind", "tenant_saved_search")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const error = [
    last24hResult.error?.message,
    last7dResult.error?.message,
    recentResult.error?.message,
  ]
    .filter(Boolean)
    .join(" | ") || null;

  return {
    last24h: last24hResult.count ?? 0,
    last7d: last7dResult.count ?? 0,
    recent: (recentResult.data as PushDeliveryAttemptRow[]) ?? [],
    error,
  };
}
