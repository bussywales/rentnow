import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightsRange } from "@/lib/admin/insights";
import { buildPropertyEventSummary, estimateMissedDemand, type PropertyEventSummary } from "@/lib/analytics/property-events";
import { fetchPropertyEvents, groupEventsByProperty } from "@/lib/analytics/property-events.server";
import { buildRevenueSignals } from "@/lib/admin/revenue-signals.server";
import type { PropertyEventRow } from "@/lib/analytics/property-events";

export type MonetisationBucket = "boost" | "recovery" | "upsell";

export type MonetisationAction = {
  label: string;
  action?: "FEATURE" | "EXTEND" | "REACTIVATE";
  href?: string;
  days?: number;
};

export type MonetisationOpportunity = {
  id: string;
  bucket: MonetisationBucket;
  listing_id: string;
  host_id: string | null;
  title: string | null;
  city: string | null;
  metrics: {
    views: number;
    saves: number;
    enquiries: number;
    rangeDays: number;
  };
  reason: string;
  actions: MonetisationAction[];
  score: number;
  is_featured?: boolean;
  featured_until?: string | null;
};

export type MonetisationOpportunities = {
  range: InsightsRange;
  market: string | null;
  buckets: {
    boost: MonetisationOpportunity[];
    recovery: MonetisationOpportunity[];
    upsell: MonetisationOpportunity[];
  };
  totals: {
    boost: number;
    recovery: number;
    upsell: number;
    total: number;
  };
};

type ListingSnapshot = {
  id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  owner_id?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  listing_intent?: string | null;
  paused_at?: string | null;
  status_updated_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type ListingMetrics = {
  views: number;
  saves: number;
  enquiries: number;
};

type ListingOpportunitySeed = ListingSnapshot & {
  metrics: ListingMetrics;
  missedDemand: number | null;
};

const MAX_PER_BUCKET = 4;
const FEATURED_SOON_DAYS = 3;

function normalizeMetric(summary: PropertyEventSummary) {
  const views = summary.uniqueViews > 0 ? summary.uniqueViews : summary.views;
  const saves = Math.max(summary.netSaves, 0);
  const enquiries = summary.enquiries + summary.viewingRequests;
  return { views, saves, enquiries };
}

function parseMarket(market?: string | null) {
  if (!market) return null;
  const trimmed = market.trim();
  return trimmed.length ? trimmed : null;
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

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid] ?? 0;
  const right = sorted[mid + 1] ?? left;
  return Math.round((left + right) / 2);
}

function isExpiringSoon(value?: string | null, now = new Date()) {
  if (!value) return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  const diff = ts - now.getTime();
  return diff > 0 && diff <= FEATURED_SOON_DAYS * 24 * 60 * 60 * 1000;
}

export function buildBoostCandidates({
  listings,
  range,
  now,
}: {
  listings: ListingOpportunitySeed[];
  range: InsightsRange;
  now: Date;
}) {
  const viewSamples = listings
    .filter((listing) => listing.status === "live")
    .map((listing) => listing.metrics.views);
  const medianViews = median(viewSamples) ?? 0;

  const candidates = listings
    .filter((listing) => listing.status === "live")
    .filter((listing) => {
      const { views, saves, enquiries } = listing.metrics;
      const hasIntent = saves >= 2 || enquiries >= 1;
      const underExposed = views <= medianViews;
      const featuredSoon = listing.is_featured ? isExpiringSoon(listing.featured_until, now) : false;
      const notFeatured = !listing.is_featured || featuredSoon;
      return hasIntent && underExposed && notFeatured;
    })
    .map((listing) => {
      const featuredSoon = listing.is_featured ? isExpiringSoon(listing.featured_until, now) : false;
      const actionType: MonetisationAction["action"] =
        listing.is_featured && featuredSoon ? "EXTEND" : "FEATURE";
      const actionLabel = listing.is_featured && featuredSoon ? "Extend" : "Feature for";
      return {
        id: `boost-${listing.id}`,
        bucket: "boost" as const,
        listing_id: listing.id,
        host_id: listing.owner_id ?? null,
        title: listing.title ?? null,
        city: listing.city ?? null,
        metrics: { ...listing.metrics, rangeDays: range.days },
        reason: `High intent (${listing.metrics.saves} saves, ${listing.metrics.enquiries} enquiries) but low visibility (${listing.metrics.views} views vs median ${medianViews}).`,
        actions: [
          {
            label: `${actionLabel} 7 days`,
            action: actionType,
            days: 7,
          },
          {
            label: `${actionLabel} 30 days`,
            action: actionType,
            days: 30,
          },
          {
            label: "Open listing",
            href: `/admin/listings?property=${listing.id}`,
          },
        ],
        score: listing.metrics.enquiries * 10 + listing.metrics.saves * 3 + listing.metrics.views,
        is_featured: listing.is_featured ?? false,
        featured_until: listing.featured_until ?? null,
      };
    });

  return candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function buildSupplyRecovery({
  listings,
  range,
}: {
  listings: ListingOpportunitySeed[];
  range: InsightsRange;
}) {
  const candidates = listings
    .filter((listing) => ["paused_owner", "paused_occupied", "expired"].includes(listing.status ?? ""))
    .filter((listing) => (listing.missedDemand ?? 0) > 0)
    .map((listing) => ({
      id: `recovery-${listing.id}`,
      bucket: "recovery" as const,
      listing_id: listing.id,
      host_id: listing.owner_id ?? null,
      title: listing.title ?? null,
      city: listing.city ?? null,
      metrics: { ...listing.metrics, rangeDays: range.days },
      reason: `Missed ~${listing.missedDemand} demand signals while paused.`,
      actions: [
        {
          label: "Reactivate",
          action: "REACTIVATE" as const,
        },
        {
          label: "Open listing",
          href: `/admin/listings?property=${listing.id}`,
        },
      ],
      score: (listing.missedDemand ?? 0) + listing.metrics.views,
    }));

  return candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function buildUpsellTargets({
  listings,
  revenueHostIds,
  range,
}: {
  listings: ListingOpportunitySeed[];
  revenueHostIds: Set<string>;
  range: InsightsRange;
}) {
  const hostStats = new Map<
    string,
    {
      hostId: string;
      liveCount: number;
      featuredCount: number;
      totalViews: number;
      totalEnquiries: number;
      topListing: ListingOpportunitySeed | null;
    }
  >();

  for (const listing of listings) {
    if (!listing.owner_id) continue;
    if (!hostStats.has(listing.owner_id)) {
      hostStats.set(listing.owner_id, {
        hostId: listing.owner_id,
        liveCount: 0,
        featuredCount: 0,
        totalViews: 0,
        totalEnquiries: 0,
        topListing: null,
      });
    }
    const stats = hostStats.get(listing.owner_id)!;
    if (listing.status === "live") stats.liveCount += 1;
    if (listing.is_featured) stats.featuredCount += 1;
    stats.totalViews += listing.metrics.views;
    stats.totalEnquiries += listing.metrics.enquiries;
    if (!stats.topListing || listing.metrics.views > stats.topListing.metrics.views) {
      stats.topListing = listing;
    }
  }

  const candidates: MonetisationOpportunity[] = [];
  hostStats.forEach((stats) => {
    if (stats.liveCount < 2) return;
    if (stats.featuredCount > 0) return;
    const leadRate = stats.totalEnquiries / Math.max(stats.totalViews, 1);
    const isMonetisable = revenueHostIds.has(stats.hostId);
    const highConversion = leadRate >= 0.02 || stats.totalEnquiries >= 2;
    if (!isMonetisable && !highConversion) return;
    const listing = stats.topListing;
    if (!listing) return;

    candidates.push({
      id: `upsell-${stats.hostId}-${listing.id}`,
      bucket: "upsell",
      listing_id: listing.id,
      host_id: stats.hostId,
      title: listing.title ?? null,
      city: listing.city ?? null,
      metrics: { ...listing.metrics, rangeDays: range.days },
      reason: `Host has ${stats.liveCount} live listings with strong demand but no featured usage.`,
      actions: [
        {
          label: "View host performance",
          href: `/admin/analytics/host/${stats.hostId}`,
        },
        {
          label: "Feature top listing",
          action: "FEATURE",
          days: 14,
        },
      ],
      score: stats.totalEnquiries * 10 + stats.totalViews,
    });
  });

  return candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export async function buildMonetisationOpportunities({
  client,
  range,
  market,
}: {
  client: SupabaseClient;
  range: InsightsRange;
  market?: string | null;
}): Promise<MonetisationOpportunities> {
  const marketFilter = parseMarket(market);
  let query = client
    .from("properties")
    .select(
      "id,title,city,status,owner_id,is_featured,featured_until,listing_intent,paused_at,status_updated_at,expires_at,updated_at,created_at"
    )
    .order("updated_at", { ascending: false })
    .limit(400);

  if (marketFilter) {
    query = query.eq("city", marketFilter);
  }

  const { data, error } = await query;
  if (error || !data) {
    return {
      range,
      market: marketFilter,
      buckets: { boost: [], recovery: [], upsell: [] },
      totals: { boost: 0, recovery: 0, upsell: 0, total: 0 },
    };
  }

  const listings = data as ListingSnapshot[];
  const propertyIds = listings.map((listing) => listing.id);
  const { rows } = propertyIds.length
    ? await fetchPropertyEvents({ propertyIds, sinceDays: range.days, client })
    : { rows: [] as PropertyEventRow[] };

  const filteredEvents = filterEventsByRange(rows ?? [], range);
  const summaryMap = buildPropertyEventSummary(filteredEvents);
  const eventsByProperty = groupEventsByProperty(filteredEvents);
  const now = new Date();

  const seeds: ListingOpportunitySeed[] = listings.map((listing) => {
    const summary = summaryMap.get(listing.id) ?? {
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
    };
    const metrics = normalizeMetric(summary);
    const missedDemand = estimateMissedDemand({
      listing,
      events: eventsByProperty.get(listing.id) ?? [],
      now,
    });
    return {
      ...listing,
      metrics,
      missedDemand: missedDemand.state === "ok" ? missedDemand.missed : null,
    };
  });

  const revenueSignals = await buildRevenueSignals({ client, range });
  const revenueHostIds = new Set(revenueSignals.host.map((host) => host.host_id));

  const boost = buildBoostCandidates({ listings: seeds, range, now }).slice(0, MAX_PER_BUCKET);
  const recovery = buildSupplyRecovery({ listings: seeds, range }).slice(0, MAX_PER_BUCKET);
  const usedListingIds = new Set([...boost, ...recovery].map((item) => item.listing_id));
  const upsell = buildUpsellTargets({ listings: seeds, revenueHostIds, range })
    .filter((item) => !usedListingIds.has(item.listing_id))
    .slice(0, MAX_PER_BUCKET);

  return {
    range,
    market: marketFilter,
    buckets: { boost, recovery, upsell },
    totals: {
      boost: boost.length,
      recovery: recovery.length,
      upsell: upsell.length,
      total: boost.length + recovery.length + upsell.length,
    },
  };
}
