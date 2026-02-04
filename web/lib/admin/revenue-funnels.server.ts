import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightsRange } from "@/lib/admin/insights";
import { fetchPropertyEvents, groupEventsByProperty } from "@/lib/analytics/property-events.server";
import { buildPropertyEventSummary, estimateMissedDemand } from "@/lib/analytics/property-events";
import type { PropertyEventRow, PropertyEventSummary } from "@/lib/analytics/property-events";
import { classifyRevenueSignals } from "@/lib/admin/revenue-signals.server";

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  conversion: number | null;
};

export type RevenueFunnel = {
  role: "tenant" | "host";
  range: InsightsRange;
  filters: {
    intent?: string | null;
    market?: string | null;
  };
  steps: FunnelStep[];
  meta?: {
    highIntentThreshold?: number | null;
  };
};

export type RevenueFunnelResponse = {
  funnel: RevenueFunnel;
};

export type TenantSignal = {
  viewed: boolean;
  saves: number;
  enquired: boolean;
};

export type HostSignalSets = {
  activated: Set<string>;
  live: Set<string>;
  highIntent: Set<string>;
  monetisable: Set<string>;
};

type ListingRow = {
  id: string;
  owner_id?: string | null;
  status?: string | null;
  listing_intent?: string | null;
  city?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  featured_at?: string | null;
  paused_at?: string | null;
  status_updated_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const EVENT_TYPES = ["property_view", "save_toggle", "lead_created", "viewing_requested"] as const;

function parseIntentFilter(intent?: string | null) {
  if (!intent) return null;
  const normalized = intent.toLowerCase();
  if (normalized === "rent") return "rent";
  if (normalized === "sale" || normalized === "buy") return "buy";
  return null;
}

function sanitizeMarket(market?: string | null) {
  if (!market) return null;
  const trimmed = market.trim();
  return trimmed.length ? trimmed : null;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildFunnelSteps(raw: Array<{ key: string; label: string; count: number }>) {
  let previous: number | null = null;
  return raw.map((step) => {
    const conversion =
      previous === null || previous === 0
        ? null
        : clampPercent((step.count / previous) * 100);
    previous = step.count;
    return { ...step, conversion };
  });
}

export function filterEventsByRange(rows: PropertyEventRow[], range: InsightsRange) {
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  return rows.filter((row) => {
    if (!row.occurred_at) return false;
    const ts = Date.parse(row.occurred_at);
    if (Number.isNaN(ts)) return false;
    return ts >= start && ts < end;
  });
}

export function computeTenantFunnel({
  visitors,
  signupsCount,
  signals,
  eligibleTenantIds,
}: {
  visitors: Set<string>;
  signupsCount: number;
  signals: Map<string, TenantSignal>;
  eligibleTenantIds?: Set<string> | null;
}) {
  let activated = 0;
  let highIntent = 0;
  let converted = 0;

  for (const [userId, signal] of signals.entries()) {
    if (eligibleTenantIds && !eligibleTenantIds.has(userId)) continue;
    const hasSave = signal.saves >= 1;
    const hasHighSave = signal.saves >= 2;
    const hasEnquiry = signal.enquired;
    if (signal.viewed && (hasSave || hasEnquiry)) activated += 1;
    if (hasHighSave || hasEnquiry) highIntent += 1;
    if (hasEnquiry) converted += 1;
  }

  return buildFunnelSteps([
    { key: "visitors", label: "Visitors", count: visitors.size },
    { key: "signups", label: "Signed up tenants", count: signupsCount },
    { key: "activated", label: "Activated tenants", count: activated },
    { key: "high_intent", label: "High-intent tenants", count: highIntent },
    { key: "converted", label: "Converted tenants", count: converted },
  ]);
}

export function computeHostFunnel({
  sets,
  highIntentThreshold,
  signupsCount,
}: {
  sets: Omit<HostSignalSets, "signups">;
  highIntentThreshold: number | null;
  signupsCount: number;
}) {
  return {
    steps: buildFunnelSteps([
      { key: "signups", label: "Signed up hosts", count: signupsCount },
      { key: "activated", label: "Activated hosts", count: sets.activated.size },
      { key: "live", label: "Live inventory hosts", count: sets.live.size },
      { key: "high_intent", label: "High-intent hosts", count: sets.highIntent.size },
      { key: "monetisable", label: "Monetisable hosts", count: sets.monetisable.size },
    ]),
    meta: { highIntentThreshold },
  };
}

function percentile(values: number[], pct: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * pct);
  return sorted[index] ?? null;
}

async function fetchProfilesByIds(
  client: SupabaseClient,
  ids: string[]
): Promise<Array<{ id: string; role: string | null; created_at: string | null; full_name?: string | null }>> {
  const rows: Array<{ id: string; role: string | null; created_at: string | null; full_name?: string | null }> = [];
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await client
      .from("profiles")
      .select("id,role,created_at,full_name")
      .in("id", slice);
    if (error) continue;
    rows.push(...((data as typeof rows) ?? []));
  }
  return rows;
}

export async function buildRevenueFunnel({
  client,
  range,
  role,
  intent,
  market,
}: {
  client: SupabaseClient;
  range: InsightsRange;
  role: "tenant" | "host";
  intent?: string | null;
  market?: string | null;
}): Promise<RevenueFunnel> {
  const intentFilter = parseIntentFilter(intent);
  const marketFilter = sanitizeMarket(market);
  const filters = { intent: intentFilter, market: marketFilter };

  if (role === "tenant") {
    let query = client
      .from("property_events")
      .select(
        "property_id,actor_user_id,session_key,event_type,meta,occurred_at,properties!inner(listing_intent,city)"
      )
      .in("event_type", EVENT_TYPES)
      .gte("occurred_at", range.start)
      .lt("occurred_at", range.end);

    if (intentFilter) query = query.eq("properties.listing_intent", intentFilter);
    if (marketFilter) query = query.eq("properties.city", marketFilter);

    const { data, error } = await query;
    if (error || !data) {
      return {
        role,
        range,
        filters,
        steps: buildFunnelSteps([
          { key: "visitors", label: "Visitors", count: 0 },
          { key: "signups", label: "Signed up tenants", count: 0 },
          { key: "activated", label: "Activated tenants", count: 0 },
          { key: "high_intent", label: "High-intent tenants", count: 0 },
          { key: "converted", label: "Converted tenants", count: 0 },
        ]),
      };
    }

    const rows = filterEventsByRange(
      (data ?? []).map((row) => ({
        property_id: row.property_id,
        actor_user_id: row.actor_user_id,
        session_key: row.session_key,
        event_type: row.event_type,
        meta: row.meta,
        occurred_at: row.occurred_at,
      })) as PropertyEventRow[],
      range
    );
    const visitors = new Set<string>();
    const tenantSignals = new Map<string, TenantSignal>();

    for (const row of rows) {
      if (row.event_type === "property_view" && !row.actor_user_id) {
        if (row.session_key) visitors.add(row.session_key);
      }

      if (!row.actor_user_id) continue;
      if (!tenantSignals.has(row.actor_user_id)) {
        tenantSignals.set(row.actor_user_id, { viewed: false, saves: 0, enquired: false });
      }
      const signal = tenantSignals.get(row.actor_user_id)!;
      if (row.event_type === "property_view") signal.viewed = true;
      if (row.event_type === "save_toggle" && row.meta?.action === "save") {
        signal.saves += 1;
      }
      if (row.event_type === "lead_created" || row.event_type === "viewing_requested") {
        signal.enquired = true;
      }
    }

    const tenantIds = Array.from(tenantSignals.keys());
    const profiles = tenantIds.length ? await fetchProfilesByIds(client, tenantIds) : [];
    const tenantProfiles = profiles.filter((profile) => profile.role === "tenant");
    const tenantIdsSet = new Set(tenantProfiles.map((profile) => profile.id));

    const restrictSignups = !!intentFilter || !!marketFilter;
    const eligibleTenantIds = new Set<string>();

    if (restrictSignups) {
      for (const profile of tenantProfiles) {
        if (!profile.created_at) continue;
        const created = Date.parse(profile.created_at);
        if (created >= Date.parse(range.start) && created < Date.parse(range.end)) {
          eligibleTenantIds.add(profile.id);
        }
      }
    } else {
      const { data: signupRows, error: signupError } = await client
        .from("profiles")
        .select("id")
        .eq("role", "tenant")
        .gte("created_at", range.start)
        .lt("created_at", range.end);
      if (!signupError) {
        for (const row of (signupRows as Array<{ id: string }>) ?? []) {
          eligibleTenantIds.add(row.id);
        }
      }
    }

    const signupsCount = eligibleTenantIds.size;

    const filteredSignals = new Map<string, TenantSignal>();
    for (const [id, signal] of tenantSignals) {
      if (tenantIdsSet.has(id)) filteredSignals.set(id, signal);
    }

    const steps = computeTenantFunnel({
      visitors,
      signupsCount,
      signals: filteredSignals,
      eligibleTenantIds,
    });

    return {
      role,
      range,
      filters,
      steps,
    };
  }

  let propertyQuery = client
    .from("properties")
    .select(
      "id,owner_id,status,listing_intent,city,created_at,is_featured,featured_until,featured_at,paused_at,status_updated_at,expires_at,updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(400);

  if (intentFilter) propertyQuery = propertyQuery.eq("listing_intent", intentFilter);
  if (marketFilter) propertyQuery = propertyQuery.eq("city", marketFilter);

  const { data: propertyRows, error: propertyError } = await propertyQuery;
  if (propertyError || !propertyRows) {
    return {
      role,
      range,
      filters,
      steps: buildFunnelSteps([
        { key: "signups", label: "Signed up hosts", count: 0 },
        { key: "activated", label: "Activated hosts", count: 0 },
        { key: "live", label: "Live inventory hosts", count: 0 },
        { key: "high_intent", label: "High-intent hosts", count: 0 },
        { key: "monetisable", label: "Monetisable hosts", count: 0 },
      ]),
      meta: { highIntentThreshold: null },
    };
  }

  const listings = (propertyRows as Array<ListingRow>) ?? [];
  const hostIdsSegment = new Set<string>();
  for (const listing of listings) {
    if (listing.owner_id) hostIdsSegment.add(listing.owner_id);
  }

  const hostProfiles = hostIdsSegment.size
    ? await fetchProfilesByIds(client, Array.from(hostIdsSegment))
    : [];
  const hostRoles = new Set(["landlord", "agent"]);
  const hostIds = new Set(
    hostProfiles.filter((profile) => hostRoles.has(profile.role ?? "")).map((profile) => profile.id)
  );

  const restrictSignups = !!intentFilter || !!marketFilter;
  let signupsCount = 0;
  if (restrictSignups) {
    for (const profile of hostProfiles) {
      if (!hostRoles.has(profile.role ?? "")) continue;
      if (!profile.created_at) continue;
      const created = Date.parse(profile.created_at);
      if (created >= Date.parse(range.start) && created < Date.parse(range.end)) {
        signupsCount += 1;
      }
    }
  } else {
    const { count } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["landlord", "agent"])
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    signupsCount = count ?? 0;
  }

  const activatedHosts = new Set<string>();
  const liveHosts = new Set<string>();
  for (const listing of listings) {
    if (!listing.owner_id || !hostIds.has(listing.owner_id)) continue;
    if (listing.created_at) {
      const created = Date.parse(listing.created_at);
      if (created >= Date.parse(range.start) && created < Date.parse(range.end)) {
        activatedHosts.add(listing.owner_id);
      }
    }
    if (listing.status === "live") {
      liveHosts.add(listing.owner_id);
    }
  }

  const propertyIds = listings.map((listing) => listing.id);
  const eventRows = propertyIds.length
    ? await fetchPropertyEvents({ propertyIds, sinceDays: range.days, client })
    : { rows: [] as PropertyEventRow[] };

  const summaryMap = buildPropertyEventSummary(eventRows.rows ?? []);
  const eventsByProperty = groupEventsByProperty(eventRows.rows ?? []);

  const viewCounts: number[] = [];
  for (const listing of listings) {
    const summary = summaryMap.get(listing.id);
    if (!summary) continue;
    const views = summary.uniqueViews > 0 ? summary.uniqueViews : summary.views;
    if (views > 0) viewCounts.push(views);
  }
  const threshold = percentile(viewCounts, 0.75);
  const highIntentHosts = new Set<string>();
  if (threshold && threshold > 0) {
    for (const listing of listings) {
      if (!listing.owner_id || !hostIds.has(listing.owner_id)) continue;
      const summary = summaryMap.get(listing.id);
      if (!summary) continue;
      const views = summary.uniqueViews > 0 ? summary.uniqueViews : summary.views;
      if (views >= threshold) highIntentHosts.add(listing.owner_id);
    }
  }

  const monetisableHosts = new Set<string>();
  const now = new Date();
  for (const listing of listings) {
    if (!listing.owner_id || !hostIds.has(listing.owner_id)) continue;
    const summary =
      summaryMap.get(listing.id) ||
      ({
        propertyId: listing.id,
        views: 0,
        uniqueViews: 0,
        saveToggles: 0,
        netSaves: 0,
        enquiries: 0,
        viewingRequests: 0,
        shares: 0,
        featuredImpressions: 0,
        featuredClicks: 0,
        featuredLeads: 0,
        lastOccurredAt: null,
      } satisfies PropertyEventSummary);

    const missedDemand = estimateMissedDemand({
      listing,
      events: eventsByProperty.get(listing.id) ?? [],
      now,
    });

    const signals = classifyRevenueSignals({
      listing,
      summary,
      missedDemand,
      now,
    });

    if (signals.length) monetisableHosts.add(listing.owner_id);
  }

  const { steps, meta } = computeHostFunnel({
    sets: {
      activated: activatedHosts,
      live: liveHosts,
      highIntent: highIntentHosts,
      monetisable: monetisableHosts,
    },
    highIntentThreshold: threshold,
    signupsCount,
  });

  return {
    role,
    range,
    filters,
    steps,
    meta,
  };
}
