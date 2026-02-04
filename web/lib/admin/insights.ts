import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPropertyEventSummary, estimateMissedDemand, type PropertyEventRow } from "@/lib/analytics/property-events";
import { fetchPropertyEvents } from "@/lib/analytics/property-events.server";

export type InsightsRangeKey = "7d" | "30d" | "90d";

export type InsightsRange = {
  key: InsightsRangeKey;
  label: string;
  days: number;
  start: string;
  end: string;
};

export type InsightsSnapshot = {
  range: InsightsRange;
  topLine: {
    visitorsDaily: number | null;
    visitorsWeekly: number | null;
    visitorsMonthly: number | null;
    totalSignups: number | null;
    newTenants: number | null;
    newHostsAgents: number | null;
    activeUsersDaily: number | null;
    activeUsersWeekly: number | null;
    activeUsersMonthly: number | null;
  };
  marketplace: {
    liveListings: number | null;
    pausedListings: number | null;
    expiredListings: number | null;
    newListings: number | null;
    views: number | null;
    enquiries: number | null;
    viewsPerListing: number | null;
    enquiriesPerListing: number | null;
    zeroViewsPct7d: number | null;
    zeroEnquiriesPct14d: number | null;
  };
  activation: {
    tenant: {
      searches: number | null;
      views: number | null;
      saves: number | null;
      contacts: number | null;
    };
    host: {
      created: number | null;
      published: number | null;
      firstView: number | null;
      firstEnquiry: number | null;
    };
  };
  revenue: {
    featuredImpressions: number | null;
    featuredClicks: number | null;
    featuredCtr: number | null;
    featuredEnquiries: number | null;
    missedDemand: number | null;
    reactivations: number | null;
  };
  notes: string[];
};

const RANGE_PRESETS: Record<InsightsRangeKey, { label: string; days: number }> = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
};

export function resolveInsightsRange(key?: string | null, now = new Date()): InsightsRange {
  const rangeKey: InsightsRangeKey =
    key && key in RANGE_PRESETS ? (key as InsightsRangeKey) : "7d";
  const preset = RANGE_PRESETS[rangeKey];
  const end = new Date(now);
  const start = new Date(end.getTime() - preset.days * 24 * 60 * 60 * 1000);
  return {
    key: rangeKey,
    label: preset.label,
    days: preset.days,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function calculateRate(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function calculatePercent(part: number | null, total: number | null) {
  if (part === null || total === null || total === 0) return null;
  return Math.round((part / total) * 100);
}

type CountResult = { count: number | null; error: { message: string } | null };

type DistinctResult<T> = { data: T[] | null; error: { message?: string } | null };

async function safeCount(promise: PromiseLike<CountResult>, label: string, notes: string[]) {
  const result = await promise;
  if (result.error) {
    notes.push(`${label}: ${result.error.message}`);
    return null;
  }
  return result.count ?? null;
}

async function safeDistinctCount<T extends Record<string, unknown>>(
  promise: PromiseLike<DistinctResult<T>>,
  label: string,
  selector: (row: T) => string | null,
  notes: string[]
) {
  const result = await promise;
  if (result.error) {
    notes.push(`${label}: ${result.error.message ?? "query_failed"}`);
    return null;
  }
  const seen = new Set<string>();
  for (const row of result.data ?? []) {
    const key = selector(row);
    if (key) seen.add(key);
  }
  return seen.size;
}

function eventActorKey(row: { session_key?: string | null; actor_user_id?: string | null }) {
  return row.session_key || row.actor_user_id || null;
}

export async function buildAdminInsights(
  adminClient: SupabaseClient,
  range: InsightsRange
): Promise<InsightsSnapshot> {
  const notes: string[] = [];
  const nowIso = new Date().toISOString();
  const last7Start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last14Start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    liveListings,
    pausedListings,
    expiredListings,
    newListings,
    totalSignups,
    newTenants,
    newHostsAgents,
    views,
    enquiriesLead,
    enquiriesViewings,
    reactivations,
  ] = await Promise.all([
    safeCount(
      adminClient
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "live")
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`),
      "liveListings",
      notes
    ),
    safeCount(
      adminClient
        .from("properties")
        .select("id", { count: "exact", head: true })
        .in("status", ["paused_owner", "paused_occupied"]),
      "pausedListings",
      notes
    ),
    safeCount(
      adminClient
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "expired"),
      "expiredListings",
      notes
    ),
    safeCount(
      adminClient
        .from("properties")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.start)
        .lt("created_at", range.end),
      "newListings",
      notes
    ),
    safeCount(
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      "totalSignups",
      notes
    ),
    safeCount(
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "tenant")
        .gte("created_at", range.start)
        .lt("created_at", range.end),
      "newTenants",
      notes
    ),
    safeCount(
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["landlord", "agent"])
        .gte("created_at", range.start)
        .lt("created_at", range.end),
      "newHostsAgents",
      notes
    ),
    safeCount(
      adminClient
        .from("property_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "property_view")
        .gte("occurred_at", range.start)
        .lt("occurred_at", range.end),
      "views",
      notes
    ),
    safeCount(
      adminClient
        .from("property_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "lead_created")
        .gte("occurred_at", range.start)
        .lt("occurred_at", range.end),
      "enquiriesLead",
      notes
    ),
    safeCount(
      adminClient
        .from("property_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "viewing_requested")
        .gte("occurred_at", range.start)
        .lt("occurred_at", range.end),
      "enquiriesViewings",
      notes
    ),
    safeCount(
      adminClient
        .from("properties")
        .select("id", { count: "exact", head: true })
        .gte("reactivated_at", range.start)
        .lt("reactivated_at", range.end),
      "reactivations",
      notes
    ),
  ]);

  const enquiries = (enquiriesLead ?? 0) + (enquiriesViewings ?? 0);

  const [
    visitorsDaily,
    visitorsWeekly,
    visitorsMonthly,
    activeUsersDaily,
    activeUsersWeekly,
    activeUsersMonthly,
  ] = await Promise.all([
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("session_key,actor_user_id")
        .eq("event_type", "property_view")
        .gte("occurred_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      "visitorsDaily",
      (row) => eventActorKey(row as { session_key?: string | null; actor_user_id?: string | null }),
      notes
    ),
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("session_key,actor_user_id")
        .eq("event_type", "property_view")
        .gte("occurred_at", last7Start),
      "visitorsWeekly",
      (row) => eventActorKey(row as { session_key?: string | null; actor_user_id?: string | null }),
      notes
    ),
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("session_key,actor_user_id")
        .eq("event_type", "property_view")
        .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      "visitorsMonthly",
      (row) => eventActorKey(row as { session_key?: string | null; actor_user_id?: string | null }),
      notes
    ),
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("actor_user_id")
        .not("actor_user_id", "is", null)
        .gte("occurred_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      "activeUsersDaily",
      (row) => ((row as { actor_user_id?: string | null }).actor_user_id ?? null),
      notes
    ),
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("actor_user_id")
        .not("actor_user_id", "is", null)
        .gte("occurred_at", last7Start),
      "activeUsersWeekly",
      (row) => ((row as { actor_user_id?: string | null }).actor_user_id ?? null),
      notes
    ),
    safeDistinctCount(
      adminClient
        .from("property_events")
        .select("actor_user_id")
        .not("actor_user_id", "is", null)
        .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      "activeUsersMonthly",
      (row) => ((row as { actor_user_id?: string | null }).actor_user_id ?? null),
      notes
    ),
  ]);

  const [
    viewsPerListing,
    enquiriesPerListing,
  ] = [
    calculateRate(views ?? null, liveListings ?? null),
    calculateRate(enquiries ?? null, liveListings ?? null),
  ];

  const viewedLiveListings = await safeDistinctCount(
    adminClient
      .from("property_events")
      .select("property_id, properties!inner(status)")
      .eq("event_type", "property_view")
      .eq("properties.status", "live")
      .gte("occurred_at", last7Start),
    "viewedLiveListings",
    (row) => (row as { property_id?: string | null }).property_id ?? null,
    notes
  );

  const enquiredLiveListings = await safeDistinctCount(
    adminClient
      .from("property_events")
      .select("property_id, properties!inner(status)")
      .in("event_type", ["lead_created", "viewing_requested"])
      .eq("properties.status", "live")
      .gte("occurred_at", last14Start),
    "enquiredLiveListings",
    (row) => (row as { property_id?: string | null }).property_id ?? null,
    notes
  );

  const zeroViewsPct7d = calculatePercent(
    liveListings !== null && viewedLiveListings !== null ? Math.max(liveListings - viewedLiveListings, 0) : null,
    liveListings
  );
  const zeroEnquiriesPct14d = calculatePercent(
    liveListings !== null && enquiredLiveListings !== null ? Math.max(liveListings - enquiredLiveListings, 0) : null,
    liveListings
  );

  const activationRowsResult = await adminClient
    .from("property_events")
    .select("event_type, meta")
    .in("event_type", ["property_view", "save_toggle", "lead_created", "viewing_requested"])
    .gte("occurred_at", range.start)
    .lt("occurred_at", range.end);

  if (activationRowsResult.error) {
    notes.push(`activationRows: ${activationRowsResult.error.message}`);
  }

  const activationRows = (activationRowsResult.data as Array<{ event_type: string; meta?: Record<string, unknown> }>) || [];
  let activationViews = 0;
  let activationSaves = 0;
  let activationContacts = 0;
  let activationSearches = 0;

  for (const row of activationRows) {
    if (row.event_type === "property_view") {
      activationViews += 1;
      const source = row.meta?.source;
      if (source === "search" || source === "saved-search" || source === "tenant_home") {
        activationSearches += 1;
      }
      continue;
    }
    if (row.event_type === "save_toggle") {
      if (row.meta?.action === "save") activationSaves += 1;
      continue;
    }
    if (row.event_type === "lead_created" || row.event_type === "viewing_requested") {
      activationContacts += 1;
    }
  }

  const hostCreated = newListings;
  const hostPublished = await safeCount(
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .gte("approved_at", range.start)
      .lt("approved_at", range.end),
    "hostPublished",
    notes
  );

  const hostFirstView = await safeDistinctCount(
    adminClient
      .from("property_events")
      .select("property_id")
      .eq("event_type", "property_view")
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end),
    "hostFirstView",
    (row) => (row as { property_id?: string | null }).property_id ?? null,
    notes
  );

  const hostFirstEnquiry = await safeDistinctCount(
    adminClient
      .from("property_events")
      .select("property_id")
      .in("event_type", ["lead_created", "viewing_requested"])
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end),
    "hostFirstEnquiry",
    (row) => (row as { property_id?: string | null }).property_id ?? null,
    notes
  );

  const featuredImpressions = await safeCount(
    adminClient
      .from("property_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "featured_impression")
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end),
    "featuredImpressions",
    notes
  );

  const featuredClicks = await safeCount(
    adminClient
      .from("property_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "property_view")
      .contains("meta", { source: "featured" })
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end),
    "featuredClicks",
    notes
  );

  const featuredCtr = calculatePercent(featuredClicks, featuredImpressions);

  let featuredEnquiries: number | null = null;
  try {
    const { data, error } = await adminClient
      .from("property_events")
      .select("property_id,event_type,actor_user_id,session_key,occurred_at,meta")
      .in("event_type", ["property_view", "lead_created", "viewing_requested", "featured_impression"])
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end);
    if (error) {
      notes.push(`featuredEnquiries: ${error.message}`);
    } else {
      const summaryMap = buildPropertyEventSummary((data as PropertyEventRow[]) ?? []);
      featuredEnquiries = Array.from(summaryMap.values()).reduce(
        (sum, row) => sum + (row.featuredLeads ?? 0),
        0
      );
    }
  } catch (err) {
    notes.push(`featuredEnquiries: ${(err as Error)?.message ?? "query_failed"}`);
  }

  let missedDemand: number | null = null;
  try {
    const { data: paused, error: pausedError } = await adminClient
      .from("properties")
      .select("id,status,paused_at,status_updated_at,expires_at,expired_at,created_at,updated_at")
      .in("status", ["paused_owner", "paused_occupied", "expired"])
      .limit(500);

    if (pausedError) {
      notes.push(`missedDemandListings: ${pausedError.message}`);
    } else {
      const rows = (paused as Array<{ id: string; status?: string | null; paused_at?: string | null; status_updated_at?: string | null; expires_at?: string | null; expired_at?: string | null; created_at?: string | null; updated_at?: string | null }>) ?? [];
      const ids = rows.map((row) => row.id);
      const eventsResult = await fetchPropertyEvents({ propertyIds: ids, sinceDays: 60, client: adminClient });
      if (eventsResult.error) {
        notes.push(`missedDemandEvents: ${eventsResult.error}`);
      }
      const byProperty = new Map<string, PropertyEventRow[]>();
      for (const event of eventsResult.rows) {
        const list = byProperty.get(event.property_id) ?? [];
        list.push(event);
        byProperty.set(event.property_id, list);
      }
      let total = 0;
      for (const listing of rows) {
        const estimate = estimateMissedDemand({
          listing,
          events: byProperty.get(listing.id) ?? [],
        });
        if (estimate.state === "ok") {
          total += estimate.missed;
        }
      }
      missedDemand = total;
    }
  } catch (err) {
    notes.push(`missedDemand: ${(err as Error)?.message ?? "query_failed"}`);
  }

  return {
    range,
    topLine: {
      visitorsDaily,
      visitorsWeekly,
      visitorsMonthly,
      totalSignups,
      newTenants,
      newHostsAgents,
      activeUsersDaily,
      activeUsersWeekly,
      activeUsersMonthly,
    },
    marketplace: {
      liveListings,
      pausedListings,
      expiredListings,
      newListings,
      views,
      enquiries,
      viewsPerListing,
      enquiriesPerListing,
      zeroViewsPct7d,
      zeroEnquiriesPct14d,
    },
    activation: {
      tenant: {
        searches: activationRowsResult.error ? null : activationSearches,
        views: activationRowsResult.error ? null : activationViews,
        saves: activationRowsResult.error ? null : activationSaves,
        contacts: activationRowsResult.error ? null : activationContacts,
      },
      host: {
        created: hostCreated ?? null,
        published: hostPublished,
        firstView: hostFirstView,
        firstEnquiry: hostFirstEnquiry,
      },
    },
    revenue: {
      featuredImpressions,
      featuredClicks,
      featuredCtr,
      featuredEnquiries,
      missedDemand,
      reactivations,
    },
    notes,
  };
}
