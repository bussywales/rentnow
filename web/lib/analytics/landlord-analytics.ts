import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

export type AnalyticsRangeKey = "last7" | "last30" | "thisMonth";

export type AnalyticsRange = {
  key: AnalyticsRangeKey;
  label: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
};

export type TrendDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat" | "not_available";
};

export type KpiMetric = {
  label: string;
  value: number | null;
  delta: number | null;
  direction: TrendDelta["direction"];
  unit: "count" | "percent" | "hours";
  available: boolean;
};

export type AnalyticsAvailability = {
  views: boolean;
  saves: boolean;
  enquiries: boolean;
  viewings: boolean;
  responseRate: boolean;
  responseTime: boolean;
};

export type HostAnalyticsSnapshot = {
  hostId: string;
  range: AnalyticsRange;
  totalListings: number | null;
  activeListings: number | null;
  kpis: {
    listingViews: KpiMetric;
    savedByTenants: KpiMetric;
    enquiries: KpiMetric;
    viewingRequests: KpiMetric;
    responseRate: KpiMetric;
    medianResponseTime: KpiMetric;
  };
  availability: AnalyticsAvailability;
  lastUpdated: string;
  notes: string[];
};

export type HostScopeInput = {
  userId: string;
  role: UserRole | null;
  actingAs: string | null;
  canActAs: boolean;
};

export function resolveAnalyticsHostId(input: HostScopeInput) {
  if (input.role === "agent" && input.actingAs && input.actingAs !== input.userId && input.canActAs) {
    return { hostId: input.actingAs, actingAsUsed: true };
  }
  return { hostId: input.userId, actingAsUsed: false };
}

const RANGE_PRESETS: Record<AnalyticsRangeKey, { label: string; days?: number }> = {
  last7: { label: "Last 7 days", days: 7 },
  last30: { label: "Last 30 days", days: 30 },
  thisMonth: { label: "This month" },
};

export function resolveAnalyticsRange(
  key: AnalyticsRangeKey | null | undefined,
  now: Date = new Date()
): AnalyticsRange {
  const rangeKey: AnalyticsRangeKey = key && key in RANGE_PRESETS ? (key as AnalyticsRangeKey) : "last7";
  const preset = RANGE_PRESETS[rangeKey];
  const end = new Date(now);
  let start: Date;
  let previousStart: Date;
  let previousEnd: Date;

  if (rangeKey === "thisMonth") {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    previousEnd = new Date(start);
    previousStart = new Date(Date.UTC(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth() - 1, 1));
  } else {
    const days = preset.days ?? 7;
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    previousEnd = new Date(start);
    previousStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return {
    key: rangeKey,
    label: preset.label,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

function buildTrend(current: number | null, previous: number | null): TrendDelta {
  if (current === null || previous === null) {
    return { current, previous, delta: null, direction: "not_available" };
  }
  const delta = current - previous;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  return { current, previous, delta, direction };
}

type CountResult = { count: number | null; error: { message: string } | null };

async function safeCount(promise: PromiseLike<CountResult>, label: string, notes: string[]) {
  const result = await promise;
  if (result.error) {
    notes.push(`${label}: ${result.error.message}`);
    return { value: null, available: false };
  }
  return { value: result.count ?? null, available: true };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

type MessageRow = {
  property_id: string;
  sender_id: string;
  recipient_id: string | null;
  created_at: string;
  properties?: { owner_id: string }[] | null;
};

async function buildMessageMetrics(
  supabase: SupabaseClient,
  hostId: string,
  range: AnalyticsRange,
  notes: string[]
) {
  const { data, error } = await supabase
    .from("messages")
    .select("property_id, sender_id, recipient_id, created_at, properties!inner(owner_id)")
    .eq("properties.owner_id", hostId)
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .order("created_at", { ascending: true });

  if (error) {
    notes.push(`messages: ${error.message}`);
    return {
      enquiries: null,
      responseRate: null,
      medianResponseHours: null,
      available: false,
    };
  }

  const rows = (data as MessageRow[]) || [];
  const threads = new Map<string, { firstTenantAt: string | null; firstHostAt: string | null }>();

  rows.forEach((row) => {
    const ownerId = row.properties?.[0]?.owner_id;
    if (!ownerId || !row.created_at) return;
    const tenantId = row.sender_id === ownerId ? row.recipient_id : row.sender_id;
    if (!tenantId) return;
    const threadKey = `${row.property_id}:${tenantId}`;
    const existing = threads.get(threadKey) ?? { firstTenantAt: null, firstHostAt: null };

    if (row.sender_id !== ownerId) {
      if (!existing.firstTenantAt) {
        existing.firstTenantAt = row.created_at;
      }
    } else if (existing.firstTenantAt && !existing.firstHostAt) {
      existing.firstHostAt = row.created_at;
    }
    threads.set(threadKey, existing);
  });

  const threadEntries = Array.from(threads.values()).filter((entry) => entry.firstTenantAt);
  const totalThreads = threadEntries.length;
  const responseTimes: number[] = [];
  let respondedCount = 0;

  threadEntries.forEach((entry) => {
    if (!entry.firstTenantAt || !entry.firstHostAt) return;
    respondedCount += 1;
    const diffMs = new Date(entry.firstHostAt).getTime() - new Date(entry.firstTenantAt).getTime();
    if (diffMs >= 0) {
      responseTimes.push(diffMs / (1000 * 60 * 60));
    }
  });

  const responseRate = totalThreads > 0 ? Math.round((respondedCount / totalThreads) * 100) : null;
  const medianResponseHours = responseTimes.length ? median(responseTimes) : null;

  return {
    enquiries: totalThreads,
    responseRate,
    medianResponseHours,
    available: true,
  };
}

export async function getLandlordAnalytics(params: {
  hostId: string;
  rangeKey?: AnalyticsRangeKey | null;
  supabase: SupabaseClient;
}): Promise<HostAnalyticsSnapshot> {
  const range = resolveAnalyticsRange(params.rangeKey);
  const notes: string[] = [];

  const totalListingsResult = await safeCount(
    params.supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", params.hostId),
    "totalListings",
    notes
  );

  const activeListingsResult = await safeCount(
    params.supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", params.hostId)
      .eq("status", "live"),
    "activeListings",
    notes
  );

  const savedCurrent = await safeCount(
    params.supabase
      .from("saved_properties")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    "savedCurrent",
    notes
  );

  const savedPrevious = await safeCount(
    params.supabase
      .from("saved_properties")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.previousStart)
      .lt("created_at", range.previousEnd),
    "savedPrevious",
    notes
  );

  const viewingsCurrent = await safeCount(
    params.supabase
      .from("viewing_requests")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    "viewingsCurrent",
    notes
  );

  const viewingsPrevious = await safeCount(
    params.supabase
      .from("viewing_requests")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.previousStart)
      .lt("created_at", range.previousEnd),
    "viewingsPrevious",
    notes
  );

  const viewsCurrent = await safeCount(
    params.supabase
      .from("property_views")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    "viewsCurrent",
    notes
  );

  const viewsPrevious = await safeCount(
    params.supabase
      .from("property_views")
      .select("id, properties!inner(owner_id)", { count: "exact", head: true })
      .eq("properties.owner_id", params.hostId)
      .gte("created_at", range.previousStart)
      .lt("created_at", range.previousEnd),
    "viewsPrevious",
    notes
  );

  const messageCurrent = await buildMessageMetrics(params.supabase, params.hostId, range, notes);
  const previousRange = {
    ...range,
    start: range.previousStart,
    end: range.previousEnd,
    previousStart: range.previousStart,
    previousEnd: range.previousEnd,
  };
  const messagePrevious = await buildMessageMetrics(
    params.supabase,
    params.hostId,
    previousRange,
    notes
  );

  const viewsTrend = buildTrend(viewsCurrent.value, viewsPrevious.value);
  const savedTrend = buildTrend(savedCurrent.value, savedPrevious.value);
  const viewingsTrend = buildTrend(viewingsCurrent.value, viewingsPrevious.value);
  const enquiriesTrend = buildTrend(messageCurrent.enquiries, messagePrevious.enquiries);
  const responseRateTrend = buildTrend(messageCurrent.responseRate, messagePrevious.responseRate);
  const responseTimeTrend = buildTrend(
    messageCurrent.medianResponseHours,
    messagePrevious.medianResponseHours
  );

  const availability: AnalyticsAvailability = {
    views: viewsCurrent.available,
    saves: savedCurrent.available,
    enquiries: messageCurrent.available,
    viewings: viewingsCurrent.available,
    responseRate: messageCurrent.available,
    responseTime: messageCurrent.available,
  };

  return {
    hostId: params.hostId,
    range,
    totalListings: totalListingsResult.value,
    activeListings: activeListingsResult.value,
    kpis: {
      listingViews: {
        label: "Listing views",
        value: viewsCurrent.value,
        delta: viewsTrend.delta,
        direction: viewsTrend.direction,
        unit: "count",
        available: viewsCurrent.available,
      },
      savedByTenants: {
        label: "Saved by tenants",
        value: savedCurrent.value,
        delta: savedTrend.delta,
        direction: savedTrend.direction,
        unit: "count",
        available: savedCurrent.available,
      },
      enquiries: {
        label: "Enquiries",
        value: messageCurrent.enquiries,
        delta: enquiriesTrend.delta,
        direction: enquiriesTrend.direction,
        unit: "count",
        available: messageCurrent.available,
      },
      viewingRequests: {
        label: "Viewing requests",
        value: viewingsCurrent.value,
        delta: viewingsTrend.delta,
        direction: viewingsTrend.direction,
        unit: "count",
        available: viewingsCurrent.available,
      },
      responseRate: {
        label: "Response rate",
        value: messageCurrent.responseRate,
        delta: responseRateTrend.delta,
        direction: responseRateTrend.direction,
        unit: "percent",
        available: messageCurrent.available,
      },
      medianResponseTime: {
        label: "Median time to respond",
        value: messageCurrent.medianResponseHours,
        delta: responseTimeTrend.delta,
        direction: responseTimeTrend.direction,
        unit: "hours",
        available: messageCurrent.available,
      },
    },
    availability,
    lastUpdated: new Date().toISOString(),
    notes,
  };
}
