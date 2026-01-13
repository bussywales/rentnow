import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PushDeliveryAttemptRow,
  PushDeliverySummary,
} from "@/lib/admin/push-delivery-telemetry";

const TENANT_PUSH_KIND = "tenant_saved_search";
const DEDUPE_TABLE = "saved_search_push_dedup";

export type TenantSubscriptionCounts = {
  available: boolean;
  error: string | null;
  total: number | null;
  active: number | null;
  last24h: number | null;
  last7d: number | null;
};

export type TenantPushAttemptsSummary = {
  available: boolean;
  error: string | null;
  lastAttemptAt: string | null;
  lastDeliveredAt: string | null;
  last24h: PushDeliverySummary | null;
  last7d: PushDeliverySummary | null;
  recent: Array<{
    created_at: string;
    status: PushDeliveryAttemptRow["status"];
    reason_code: string | null;
    delivered_count: number;
    failed_count: number;
    blocked_count: number;
    skipped_count: number;
  }>;
};

export type TenantPushDedupeSummary = {
  available: boolean;
  error: string | null;
  last24h: number | null;
  last7d: number | null;
  topReasons: Array<{ reason: string; count: number }>;
};

export type TenantPushDiagnostics = {
  subscriptions: TenantSubscriptionCounts;
  attempts: TenantPushAttemptsSummary;
  dedupe: TenantPushDedupeSummary;
};

type DedupeRow = {
  reason_code: string | null;
  created_at?: string | null;
};

function toIsoSince(msAgo: number) {
  return new Date(Date.now() - msAgo).toISOString();
}

export function buildTotalsFromRows(
  rows: PushDeliveryAttemptRow[]
): PushDeliverySummary {
  const totals = rows.reduce<PushDeliverySummary>(
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

  return rows.reduce<PushDeliverySummary>(
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

function buildTopReasons(rows: DedupeRow[], limit: number) {
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

export async function fetchTenantSubscriptionCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<TenantSubscriptionCounts> {
  const last24hStart = toIsoSince(24 * 60 * 60 * 1000);
  const last7dStart = toIsoSince(7 * 24 * 60 * 60 * 1000);

  const [totalRes, activeRes, last24hRes, last7dRes] = await Promise.all([
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId)
      .eq("is_active", true),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId)
      .gte("created_at", last24hStart),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId)
      .gte("created_at", last7dStart),
  ]);

  const error = [
    totalRes.error?.message,
    activeRes.error?.message,
    last24hRes.error?.message,
    last7dRes.error?.message,
  ]
    .filter(Boolean)
    .join(" | ");

  if (error) {
    return {
      available: false,
      error,
      total: null,
      active: null,
      last24h: null,
      last7d: null,
    };
  }

  return {
    available: true,
    error: null,
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    last24h: last24hRes.count ?? 0,
    last7d: last7dRes.count ?? 0,
  };
}

async function checkTenantAttemptAttribution(
  adminDb: SupabaseClient
): Promise<{ available: boolean; error: string | null }> {
  const { data, error } = await adminDb
    .from("push_delivery_attempts")
    .select("actor_user_id, meta")
    .eq("kind", TENANT_PUSH_KIND)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { available: false, error: error.message };
  }

  const rows =
    (data as Array<{
      actor_user_id?: string | null;
      meta?: Record<string, unknown> | null;
    }>) ?? [];
  const hasTenantKey = rows.some((row) => {
    if (row.actor_user_id) return true;
    const meta = row.meta ?? {};
    return "tenant_id" in meta || "tenantId" in meta;
  });

  if (!hasTenantKey) {
    return { available: false, error: "tenant attribution not recorded" };
  }

  return { available: true, error: null };
}

export async function fetchTenantPushAttempts(
  adminDb: SupabaseClient | null,
  userId: string
): Promise<TenantPushAttemptsSummary> {
  if (!adminDb) {
    return {
      available: false,
      error: "service role unavailable",
      lastAttemptAt: null,
      lastDeliveredAt: null,
      last24h: null,
      last7d: null,
      recent: [],
    };
  }

  const attribution = await checkTenantAttemptAttribution(adminDb);
  if (!attribution.available) {
    return {
      available: false,
      error: attribution.error,
      lastAttemptAt: null,
      lastDeliveredAt: null,
      last24h: null,
      last7d: null,
      recent: [],
    };
  }

  const last7dStart = toIsoSince(7 * 24 * 60 * 60 * 1000);
  const last24hStart = toIsoSince(24 * 60 * 60 * 1000);
  const tenantFilter = `actor_user_id.eq.${userId},meta->>tenant_id.eq.${userId},meta->>tenantId.eq.${userId}`;

  const { data, error } = await adminDb
    .from("push_delivery_attempts")
    .select(
      "created_at, status, reason_code, delivered_count, failed_count, blocked_count, skipped_count"
    )
    .eq("kind", TENANT_PUSH_KIND)
    .gte("created_at", last7dStart)
    .or(tenantFilter);

  if (error) {
    return {
      available: false,
      error: error.message,
      lastAttemptAt: null,
      lastDeliveredAt: null,
      last24h: null,
      last7d: null,
      recent: [],
    };
  }

  const rows = (data as PushDeliveryAttemptRow[]) ?? [];
  const recent = [...rows]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 10)
    .map((row) => ({
      created_at: row.created_at,
      status: row.status,
      reason_code: row.reason_code,
      delivered_count: row.delivered_count ?? 0,
      failed_count: row.failed_count ?? 0,
      blocked_count: row.blocked_count ?? 0,
      skipped_count: row.skipped_count ?? 0,
    }));

  const lastAttemptAt = recent[0]?.created_at ?? null;
  const lastDeliveredAt = [...rows]
    .filter((row) => row.status === "delivered" || row.status === "sent")
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0]
    ?.created_at ?? null;

  const last24hRows = rows.filter((row) => {
    if (!row.created_at) return false;
    return row.created_at >= last24hStart;
  });

  return {
    available: true,
    error: null,
    lastAttemptAt,
    lastDeliveredAt,
    last24h: buildTotalsFromRows(last24hRows),
    last7d: buildTotalsFromRows(rows),
    recent,
  };
}

export async function fetchTenantPushDedupe(
  adminDb: SupabaseClient | null,
  userId: string
): Promise<TenantPushDedupeSummary> {
  if (!adminDb) {
    return {
      available: false,
      error: "service role unavailable",
      last24h: null,
      last7d: null,
      topReasons: [],
    };
  }

  const last7dStart = toIsoSince(7 * 24 * 60 * 60 * 1000);
  const last24hStart = toIsoSince(24 * 60 * 60 * 1000);

  const { data, error } = await adminDb
    .from(DEDUPE_TABLE)
    .select("reason_code, created_at")
    .eq("tenant_id", userId)
    .gte("created_at", last7dStart);

  if (error) {
    return {
      available: false,
      error: error.message,
      last24h: null,
      last7d: null,
      topReasons: [],
    };
  }

  const rows = (data as DedupeRow[]) ?? [];
  const last24hCount = rows.filter((row) => {
    if (!row.created_at) return false;
    return row.created_at >= last24hStart;
  }).length;

  return {
    available: true,
    error: null,
    last24h: last24hCount,
    last7d: rows.length,
    topReasons: buildTopReasons(rows, 5),
  };
}

export async function fetchTenantPushDiagnostics(input: {
  supabase: SupabaseClient;
  adminDb: SupabaseClient | null;
  userId: string;
}): Promise<TenantPushDiagnostics> {
  const [subscriptions, attempts, dedupe] = await Promise.all([
    fetchTenantSubscriptionCounts(input.supabase, input.userId),
    fetchTenantPushAttempts(input.adminDb, input.userId),
    fetchTenantPushDedupe(input.adminDb, input.userId),
  ]);

  return { subscriptions, attempts, dedupe };
}

export const __test__ = {
  buildTotalsFromRows,
  buildTopReasons,
};
