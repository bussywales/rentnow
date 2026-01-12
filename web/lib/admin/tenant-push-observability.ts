import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PushDeliveryAttemptRow,
  PushDeliverySummary,
} from "@/lib/admin/push-delivery-telemetry";

const TENANT_PUSH_KIND = "tenant_saved_search";
const DEDUPE_TABLE = "saved_search_push_dedup";

export type TenantPushWindowTotals = PushDeliverySummary;

export type TenantPushTopReason = {
  reason: string;
  count: number;
};

export type TenantPushDedupeStats = {
  available: boolean;
  error: string | null;
  totalRows: number;
  uniquePairs: number;
  topReason: string | null;
};

export type TenantPushObservability = {
  available: boolean;
  error: string | null;
  last24h: TenantPushWindowTotals | null;
  last7d: TenantPushWindowTotals | null;
  recent: PushDeliveryAttemptRow[];
  topReasons: TenantPushTopReason[];
  dedupe: TenantPushDedupeStats;
};

type DedupeRow = {
  tenant_id: string;
  property_id: string;
  reason_code: string | null;
  created_at?: string | null;
};

function toIsoSince(msAgo: number) {
  return new Date(Date.now() - msAgo).toISOString();
}

function buildTotalsFromRows(rows: PushDeliveryAttemptRow[]): TenantPushWindowTotals {
  const totals = rows.reduce<TenantPushWindowTotals>(
    (acc, row) => {
      acc.delivered += row.delivered_count ?? 0;
      acc.failed += row.failed_count ?? 0;
      acc.blocked += row.blocked_count ?? 0;
      acc.skipped += row.skipped_count ?? 0;
      return acc;
    },
    { attempted: 0, delivered: 0, failed: 0, blocked: 0, skipped: 0 }
  );

  const hasCounts =
    totals.delivered + totals.failed + totals.blocked + totals.skipped > 0;
  if (hasCounts) {
    totals.attempted =
      totals.delivered + totals.failed + totals.blocked + totals.skipped;
    return totals;
  }

  return rows.reduce<TenantPushWindowTotals>(
    (acc, row) => {
      if (row.status === "attempted") acc.attempted += 1;
      if (row.status === "delivered" || row.status === "sent") acc.delivered += 1;
      if (row.status === "failed") acc.failed += 1;
      if (row.status === "blocked") acc.blocked += 1;
      if (row.status === "skipped") acc.skipped += 1;
      return acc;
    },
    { attempted: 0, delivered: 0, failed: 0, blocked: 0, skipped: 0 }
  );
}

function buildTopReasons(
  rows: PushDeliveryAttemptRow[],
  limit: number
): TenantPushTopReason[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.reason_code ?? "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => ({ reason, count }));
}

async function fetchSavedSearchDedupeStats(
  adminDb: SupabaseClient,
  windowDays: number
): Promise<TenantPushDedupeStats> {
  const start = toIsoSince(windowDays * 24 * 60 * 60 * 1000);
  const { data, error } = await adminDb
    .from(DEDUPE_TABLE)
    .select("tenant_id, property_id, reason_code, created_at")
    .gte("created_at", start);

  if (error) {
    return {
      available: false,
      error: error.message,
      totalRows: 0,
      uniquePairs: 0,
      topReason: null,
    };
  }

  const rows = (data as DedupeRow[]) ?? [];
  const uniquePairs = new Set(
    rows.map((row) => `${row.tenant_id}:${row.property_id}`)
  ).size;
  const reasonCounts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.reason_code ?? "none";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  });

  const topReason =
    Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  return {
    available: true,
    error: null,
    totalRows: rows.length,
    uniquePairs,
    topReason,
  };
}

export async function fetchTenantPushObservability(
  adminDb: SupabaseClient,
  options?: { recentLimit?: number; reasonLimit?: number }
): Promise<TenantPushObservability> {
  const recentLimit = options?.recentLimit ?? 10;
  const reasonLimit = options?.reasonLimit ?? 5;
  const last7dStart = toIsoSince(7 * 24 * 60 * 60 * 1000);
  const last24hStart = toIsoSince(24 * 60 * 60 * 1000);

  const last7dResult = await adminDb
    .from("push_delivery_attempts")
    .select(
      "created_at, status, reason_code, delivered_count, failed_count, blocked_count, skipped_count, meta"
    )
    .eq("kind", TENANT_PUSH_KIND)
    .gte("created_at", last7dStart);

  const recentResult = await adminDb
    .from("push_delivery_attempts")
    .select(
      "id, created_at, actor_user_id, kind, status, reason_code, delivered_count, failed_count, blocked_count, skipped_count, meta"
    )
    .eq("kind", TENANT_PUSH_KIND)
    .order("created_at", { ascending: false })
    .limit(recentLimit);

  const dedupe = await fetchSavedSearchDedupeStats(adminDb, 7);

  if (last7dResult.error) {
    return {
      available: false,
      error: last7dResult.error.message,
      last24h: null,
      last7d: null,
      recent: [],
      topReasons: [],
      dedupe,
    };
  }

  const rows = (last7dResult.data as PushDeliveryAttemptRow[]) ?? [];
  const last24hRows = rows.filter((row) => {
    if (!row.created_at) return false;
    return row.created_at >= last24hStart;
  });
  const recent = (recentResult.data as PushDeliveryAttemptRow[]) ?? [];
  const error = [
    recentResult.error?.message,
    dedupe.error,
  ]
    .filter(Boolean)
    .join(" | ") || null;

  return {
    available: true,
    error,
    last24h: buildTotalsFromRows(last24hRows),
    last7d: buildTotalsFromRows(rows),
    recent,
    topReasons: buildTopReasons(rows, reasonLimit),
    dedupe,
  };
}

export const __test__ = {
  buildTotalsFromRows,
  buildTopReasons,
};
