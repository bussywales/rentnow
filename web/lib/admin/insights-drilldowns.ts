import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightsRange } from "@/lib/admin/insights";
import { fetchPropertyEvents } from "@/lib/analytics/property-events.server";
import { type PropertyEventRow } from "@/lib/analytics/property-events";

export type ListingHealthFlag = "zero_views" | "zero_enquiries" | "paused_demand" | "expiring_soon";

export type MarketPerformanceRow = {
  city: string;
  visitors: number;
  views: number;
  enquiries: number;
  conversion: number | null;
  viewsGrowthPct?: number | null;
  enquiriesGrowthPct?: number | null;
};

export type ListingHealthRow = {
  id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  updated_at: string | null;
  expires_at: string | null;
  paused_at: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  views_range: number;
  views_7d: number;
  leads_14d: number;
  paused_views: number;
  flags: ListingHealthFlag[];
};

export type CohortBucket = {
  label: string;
  start: string;
  end: string;
  signedUp: number;
  viewed: number | null;
  saved: number | null;
  enquired: number | null;
  createdListing?: number | null;
  submittedReview?: number | null;
  listingLive?: number | null;
  firstView?: number | null;
  receivedLead?: number | null;
};

export type InsightsAlert = {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warn" | "critical";
  count: number;
  href: string;
};

export type InsightsDrilldownData = {
  markets: {
    top: MarketPerformanceRow[];
    emerging: MarketPerformanceRow[];
    all: MarketPerformanceRow[];
  };
  listingHealth: ListingHealthRow[];
  tenantCohorts: CohortBucket[];
  hostCohorts: CohortBucket[];
  alerts: InsightsAlert[];
};

function toDate(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function formatWeekLabel(date: Date) {
  return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function calculateGrowthPct(current: number, previous: number) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeEmergingMarkets(
  current: Map<string, MarketPerformanceRow>,
  previous: Map<string, MarketPerformanceRow>
) {
  const rows: MarketPerformanceRow[] = [];
  for (const [city, row] of current) {
    const prev = previous.get(city);
    const viewsGrowthPct = calculateGrowthPct(row.views, prev?.views ?? 0);
    const enquiriesGrowthPct = calculateGrowthPct(row.enquiries, prev?.enquiries ?? 0);
    rows.push({
      ...row,
      viewsGrowthPct,
      enquiriesGrowthPct,
    });
  }
  rows.sort((a, b) => {
    const scoreA = (a.viewsGrowthPct ?? 0) + (a.enquiriesGrowthPct ?? 0);
    const scoreB = (b.viewsGrowthPct ?? 0) + (b.enquiriesGrowthPct ?? 0);
    return scoreB - scoreA;
  });
  return rows.slice(0, 6);
}

export function computeListingFlags(row: ListingHealthRow, now: Date) {
  const flags: ListingHealthFlag[] = [];
  if (row.views_range === 0) flags.push("zero_views");
  if (row.leads_14d === 0) flags.push("zero_enquiries");
  if (row.status && row.status.startsWith("paused") && row.paused_views > 0) {
    flags.push("paused_demand");
  }
  if (row.expires_at) {
    const expiresAt = toDate(row.expires_at);
    if (expiresAt) {
      const diff = expiresAt.getTime() - now.getTime();
      if (diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000) flags.push("expiring_soon");
    }
  }
  return flags;
}

export function buildAlerts({
  rangeKey,
  listingRows,
  featuredCtrCurrent,
  featuredCtrPrevious,
}: {
  rangeKey: string;
  listingRows: ListingHealthRow[];
  featuredCtrCurrent: number | null;
  featuredCtrPrevious: number | null;
}) {
  const alerts: InsightsAlert[] = [];
  const zeroViewsCount = listingRows.filter((row) => row.flags.includes("zero_views")).length;
  if (zeroViewsCount) {
    alerts.push({
      id: "zero-views",
      title: "Listings with 0 views",
      description: "Listings received no views in the selected range.",
      severity: "warn",
      count: zeroViewsCount,
      href: `/admin/insights?range=${rangeKey}&flag=zero_views#listing-health`,
    });
  }

  const zeroEnquiriesCount = listingRows.filter((row) => row.flags.includes("zero_enquiries")).length;
  if (zeroEnquiriesCount) {
    alerts.push({
      id: "zero-enquiries",
      title: "Listings with 0 enquiries",
      description: "Listings received no enquiries in the last 14 days.",
      severity: "warn",
      count: zeroEnquiriesCount,
      href: `/admin/insights?range=${rangeKey}&flag=zero_enquiries#listing-health`,
    });
  }

  const pausedDemandCount = listingRows.filter((row) => row.flags.includes("paused_demand")).length;
  if (pausedDemandCount) {
    alerts.push({
      id: "paused-demand",
      title: "Paused listings still in demand",
      description: "Views are landing on paused listings. Consider reactivation guidance.",
      severity: "info",
      count: pausedDemandCount,
      href: `/admin/insights?range=${rangeKey}&flag=paused_demand#listing-health`,
    });
  }

  const expiringCount = listingRows.filter((row) => row.flags.includes("expiring_soon")).length;
  if (expiringCount) {
    alerts.push({
      id: "expiring-soon",
      title: "Listings expiring soon",
      description: "Listings expiring within 7 days need renewal outreach.",
      severity: "info",
      count: expiringCount,
      href: `/admin/insights?range=${rangeKey}&flag=expiring_soon#listing-health`,
    });
  }

  if (featuredCtrCurrent !== null && featuredCtrPrevious !== null && featuredCtrPrevious > 0) {
    if (featuredCtrCurrent < featuredCtrPrevious * 0.8) {
      alerts.push({
        id: "featured-drop",
        title: "Featured CTR drop",
        description: "Featured CTR is down >20% vs the previous period.",
        severity: "warn",
        count: Math.round(((featuredCtrPrevious - featuredCtrCurrent) / featuredCtrPrevious) * 100),
        href: `/admin/insights?range=${rangeKey}#revenue-signals`,
      });
    }
  }

  return alerts;
}

function collectMarketMap(rows: Array<{ city: string | null; event_type: string; actor_user_id?: string | null; session_key?: string | null }>) {
  const map = new Map<string, MarketPerformanceRow>();
  const visitorSets = new Map<string, Set<string>>();
  for (const row of rows) {
    const city = row.city?.trim() || "Unknown";
    if (!map.has(city)) {
      map.set(city, { city, visitors: 0, views: 0, enquiries: 0, conversion: null });
    }
    const bucket = map.get(city)!;
    if (row.event_type === "property_view") {
      bucket.views += 1;
      const key = row.session_key || row.actor_user_id;
      if (key) {
        if (!visitorSets.has(city)) visitorSets.set(city, new Set());
        visitorSets.get(city)!.add(key);
      }
    } else if (row.event_type === "lead_created" || row.event_type === "viewing_requested") {
      bucket.enquiries += 1;
    }
  }
  for (const [city, set] of visitorSets) {
    const bucket = map.get(city);
    if (bucket) bucket.visitors = set.size;
  }
  for (const bucket of map.values()) {
    bucket.conversion = bucket.views > 0 ? Math.round((bucket.enquiries / bucket.views) * 1000) / 10 : null;
  }
  return map;
}

async function fetchMarketRows(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<Array<{ city: string | null; event_type: string; actor_user_id?: string | null; session_key?: string | null }>> {
  const { data, error } = await client
    .from("property_events")
    .select("event_type,actor_user_id,session_key,properties!inner(city)")
    .in("event_type", ["property_view", "lead_created", "viewing_requested"])
    .gte("occurred_at", start)
    .lt("occurred_at", end);

  if (error) {
    throw error;
  }

  const rows = (data as Array<{ event_type: string; actor_user_id?: string | null; session_key?: string | null; properties?: { city?: string | null } | null }>) || [];
  return rows.map((row) => ({
    event_type: row.event_type,
    actor_user_id: row.actor_user_id ?? null,
    session_key: row.session_key ?? null,
    city: row.properties?.city ?? null,
  }));
}

function buildBuckets(range: InsightsRange, bucketDays = 7) {
  const buckets: CohortBucket[] = [];
  const start = new Date(range.start);
  const end = new Date(range.end);
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + bucketDays * 86400000)) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(Math.min(cursor.getTime() + bucketDays * 86400000, end.getTime()));
    buckets.push({
      label: formatWeekLabel(bucketStart),
      start: bucketStart.toISOString(),
      end: bucketEnd.toISOString(),
      signedUp: 0,
      viewed: 0,
      saved: 0,
      enquired: 0,
      createdListing: 0,
      submittedReview: 0,
      listingLive: 0,
      firstView: 0,
      receivedLead: 0,
    });
  }
  return buckets;
}

function findBucketIndex(buckets: CohortBucket[], timestamp: string) {
  const ts = Date.parse(timestamp);
  return buckets.findIndex((bucket) => ts >= Date.parse(bucket.start) && ts < Date.parse(bucket.end));
}

async function fetchPropertyEventsByActors(
  client: SupabaseClient,
  actorIds: string[],
  range: InsightsRange
): Promise<PropertyEventRow[]> {
  const rows: PropertyEventRow[] = [];
  const chunkSize = 200;
  for (let i = 0; i < actorIds.length; i += chunkSize) {
    const chunk = actorIds.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("property_events")
      .select("actor_user_id,event_type,occurred_at,session_key,property_id,meta")
      .in("actor_user_id", chunk)
      .in("event_type", ["property_view", "save_toggle", "lead_created", "viewing_requested"])
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end);
    if (error) {
      throw error;
    }
    rows.push(...(((data as PropertyEventRow[]) ?? []) as PropertyEventRow[]));
  }
  return rows;
}

async function fetchPropertiesByOwners(
  client: SupabaseClient,
  ownerIds: string[],
  range: InsightsRange
) {
  const rows: Array<{
    id: string;
    owner_id: string;
    created_at: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    status: string | null;
  }> = [];
  const chunkSize = 200;
  for (let i = 0; i < ownerIds.length; i += chunkSize) {
    const chunk = ownerIds.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("properties")
      .select("id,owner_id,created_at,submitted_at,approved_at,status")
      .in("owner_id", chunk)
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    if (error) {
      throw error;
    }
    rows.push(...((data as typeof rows) ?? []));
  }
  return rows;
}

export async function buildInsightsDrilldowns(
  client: SupabaseClient,
  range: InsightsRange
): Promise<InsightsDrilldownData> {
  const previousStart = new Date(Date.parse(range.start) - range.days * 24 * 60 * 60 * 1000).toISOString();
  const previousEnd = range.start;

  const [currentMarketRows, previousMarketRows] = await Promise.all([
    fetchMarketRows(client, range.start, range.end),
    fetchMarketRows(client, previousStart, previousEnd),
  ]);

  const currentMarkets = collectMarketMap(currentMarketRows);
  const previousMarkets = collectMarketMap(previousMarketRows);

  const allMarkets = Array.from(currentMarkets.values()).sort((a, b) => b.views - a.views);
  const emergingMarkets = computeEmergingMarkets(currentMarkets, previousMarkets);

  const listingResult = await client
    .from("properties")
    .select("id,title,city,status,updated_at,paused_at,expires_at,is_featured,featured_until")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (listingResult.error) {
    throw listingResult.error;
  }

  const listings = (listingResult.data as ListingHealthRow[]) ?? [];
  const listingIds = listings.map((row) => row.id);
  const eventRows = listingIds.length
    ? await fetchPropertyEvents({
        propertyIds: listingIds,
        sinceDays: Math.max(range.days, 14),
        client,
      })
    : { rows: [] as PropertyEventRow[] };

  const now = new Date();
  const rangeStartTs = Date.parse(range.start);
  const rangeEndTs = Date.parse(range.end);
  const last7Start = Date.parse(new Date(now.getTime() - 7 * 86400000).toISOString());
  const last14Start = Date.parse(new Date(now.getTime() - 14 * 86400000).toISOString());

  const eventsByProperty = new Map<string, PropertyEventRow[]>();
  for (const row of eventRows.rows) {
    const list = eventsByProperty.get(row.property_id) ?? [];
    list.push(row);
    eventsByProperty.set(row.property_id, list);
  }

  const listingHealth: ListingHealthRow[] = listings.map((listing) => {
    const events = eventsByProperty.get(listing.id) ?? [];
    let viewsRange = 0;
    let views7d = 0;
    let leads14d = 0;
    let pausedViews = 0;
    const pausedAtTs = listing.paused_at ? Date.parse(listing.paused_at) : null;

    for (const event of events) {
      if (!event.occurred_at) continue;
      const ts = Date.parse(event.occurred_at);
      if (Number.isNaN(ts)) continue;
      if (event.event_type === "property_view") {
        if (ts >= rangeStartTs && ts < rangeEndTs) viewsRange += 1;
        if (ts >= last7Start) views7d += 1;
        if (pausedAtTs && ts >= pausedAtTs) pausedViews += 1;
      }
      if (event.event_type === "lead_created" || event.event_type === "viewing_requested") {
        if (ts >= last14Start) leads14d += 1;
      }
    }

    const row: ListingHealthRow = {
      ...listing,
      views_range: viewsRange,
      views_7d: views7d,
      leads_14d: leads14d,
      paused_views: pausedViews,
      flags: [],
    };

    row.flags = computeListingFlags(row, now);
    return row;
  });

  const tenantBuckets = buildBuckets(range);
  const hostBuckets = buildBuckets(range);

  const { data: tenantProfiles, error: tenantError } = await client
    .from("profiles")
    .select("id,created_at")
    .eq("role", "tenant")
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  if (tenantError) throw tenantError;
  const tenantRows = (tenantProfiles as Array<{ id: string; created_at: string }>) ?? [];
  const tenantIds = tenantRows.map((row) => row.id);

  for (const row of tenantRows) {
    const index = findBucketIndex(tenantBuckets, row.created_at);
    if (index >= 0) tenantBuckets[index].signedUp += 1;
  }

  if (tenantIds.length) {
    const tenantEvents = await fetchPropertyEventsByActors(client, tenantIds, range);
    const tenantSignals = new Map<string, { viewed: boolean; saved: boolean; enquired: boolean }>();
    for (const row of tenantEvents) {
      if (!row.actor_user_id) continue;
      if (!tenantSignals.has(row.actor_user_id)) {
        tenantSignals.set(row.actor_user_id, { viewed: false, saved: false, enquired: false });
      }
      const state = tenantSignals.get(row.actor_user_id)!;
      if (row.event_type === "property_view") state.viewed = true;
      if (row.event_type === "save_toggle" && row.meta?.action === "save") state.saved = true;
      if (row.event_type === "lead_created" || row.event_type === "viewing_requested") state.enquired = true;
    }
    for (const row of tenantRows) {
      const index = findBucketIndex(tenantBuckets, row.created_at);
      if (index < 0) continue;
      const signals = tenantSignals.get(row.id);
      if (!signals) continue;
      if (signals.viewed) tenantBuckets[index].viewed! += 1;
      if (signals.saved) tenantBuckets[index].saved! += 1;
      if (signals.enquired) tenantBuckets[index].enquired! += 1;
    }
  }

  const { data: hostProfiles, error: hostError } = await client
    .from("profiles")
    .select("id,created_at")
    .in("role", ["landlord", "agent"])
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  if (hostError) throw hostError;
  const hostRows = (hostProfiles as Array<{ id: string; created_at: string }>) ?? [];
  const hostIds = hostRows.map((row) => row.id);

  for (const row of hostRows) {
    const index = findBucketIndex(hostBuckets, row.created_at);
    if (index >= 0) hostBuckets[index].signedUp += 1;
  }

  if (hostIds.length) {
    const properties = await fetchPropertiesByOwners(client, hostIds, range);
    const ownerSignals = new Map<string, { created: boolean; submitted: boolean; live: boolean; viewed: boolean; lead: boolean }>();
    const ownerPropertyMap = new Map<string, string[]>();
    for (const property of properties) {
      const signals = ownerSignals.get(property.owner_id) ?? {
        created: false,
        submitted: false,
        live: false,
        viewed: false,
        lead: false,
      };
      signals.created = true;
      if (property.submitted_at) signals.submitted = true;
      if (property.approved_at || property.status === "live") signals.live = true;
      ownerSignals.set(property.owner_id, signals);
      const list = ownerPropertyMap.get(property.owner_id) ?? [];
      list.push(property.id);
      ownerPropertyMap.set(property.owner_id, list);
    }

    const allPropertyIds = Array.from(new Set(properties.map((row) => row.id)));
    if (allPropertyIds.length) {
      const events = await fetchPropertyEvents({
        propertyIds: allPropertyIds,
        sinceDays: range.days,
        client,
      });
      const eventsByOwner = new Map<string, { viewed: boolean; lead: boolean }>();
      const propertyOwnerMap = new Map<string, string>();
      for (const property of properties) {
        propertyOwnerMap.set(property.id, property.owner_id);
      }
      for (const event of events.rows) {
        const ownerId = propertyOwnerMap.get(event.property_id);
        if (!ownerId) continue;
        const state = eventsByOwner.get(ownerId) ?? { viewed: false, lead: false };
        if (event.event_type === "property_view") state.viewed = true;
        if (event.event_type === "lead_created" || event.event_type === "viewing_requested") state.lead = true;
        eventsByOwner.set(ownerId, state);
      }
      for (const [ownerId, signal] of eventsByOwner) {
        const existing = ownerSignals.get(ownerId) ?? {
          created: false,
          submitted: false,
          live: false,
          viewed: false,
          lead: false,
        };
        existing.viewed = signal.viewed;
        existing.lead = signal.lead;
        ownerSignals.set(ownerId, existing);
      }
    }

    for (const row of hostRows) {
      const index = findBucketIndex(hostBuckets, row.created_at);
      if (index < 0) continue;
      const signals = ownerSignals.get(row.id);
      if (!signals) continue;
      if (signals.created) hostBuckets[index].createdListing = (hostBuckets[index].createdListing ?? 0) + 1;
      if (signals.submitted) hostBuckets[index].submittedReview = (hostBuckets[index].submittedReview ?? 0) + 1;
      if (signals.live) hostBuckets[index].listingLive = (hostBuckets[index].listingLive ?? 0) + 1;
      if (signals.viewed) hostBuckets[index].firstView = (hostBuckets[index].firstView ?? 0) + 1;
      if (signals.lead) hostBuckets[index].receivedLead = (hostBuckets[index].receivedLead ?? 0) + 1;
    }
  }

  const featuredCurrent = await client
    .from("property_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "featured_impression")
    .gte("occurred_at", range.start)
    .lt("occurred_at", range.end);

  const featuredClicksCurrent = await client
    .from("property_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "property_view")
    .contains("meta", { source: "featured" })
    .gte("occurred_at", range.start)
    .lt("occurred_at", range.end);

  const featuredPrev = await client
    .from("property_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "featured_impression")
    .gte("occurred_at", previousStart)
    .lt("occurred_at", previousEnd);

  const featuredClicksPrev = await client
    .from("property_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "property_view")
    .contains("meta", { source: "featured" })
    .gte("occurred_at", previousStart)
    .lt("occurred_at", previousEnd);

  const ctrCurrent =
    featuredCurrent.count && featuredClicksCurrent.count
      ? Math.round((featuredClicksCurrent.count / featuredCurrent.count) * 100)
      : null;
  const ctrPrevious =
    featuredPrev.count && featuredClicksPrev.count
      ? Math.round((featuredClicksPrev.count / featuredPrev.count) * 100)
      : null;

  const alerts = buildAlerts({
    rangeKey: range.key,
    listingRows: listingHealth,
    featuredCtrCurrent: ctrCurrent,
    featuredCtrPrevious: ctrPrevious,
  });

  return {
    markets: {
      top: allMarkets.slice(0, 8),
      emerging: emergingMarkets,
      all: allMarkets,
    },
    listingHealth,
    tenantCohorts: tenantBuckets,
    hostCohorts: hostBuckets,
    alerts,
  };
}
