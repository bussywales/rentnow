import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPropertyEventSummary, estimateMissedDemand } from "@/lib/analytics/property-events";
import { fetchPropertyEvents, groupEventsByProperty } from "@/lib/analytics/property-events.server";
import type { PropertyEventSummary } from "@/lib/analytics/property-events";
import type { InsightsRange } from "@/lib/admin/insights";

export type RevenueSignalType =
  | "HIGH_DEMAND_LOW_CONVERSION"
  | "MISSED_DEMAND_WHILE_PAUSED"
  | "FEATURED_EXPIRED_HIGH_PERFORMANCE"
  | "HIGH_INTEREST_FOR_SALE";

export type RevenueSignal = {
  id: string;
  type: RevenueSignalType;
  listing_id: string;
  host_id: string | null;
  city: string | null;
  title: string | null;
  reason: string;
  metrics: {
    views: number;
    saves: number;
    enquiries: number;
    leadRate: number;
    featuredImpressions: number;
    featuredLeads: number;
    missedDemand: number | null;
  };
};

export type RevenueListingOpportunity = {
  listing_id: string;
  title: string | null;
  city: string | null;
  host_id: string | null;
  types: RevenueSignalType[];
  views: number;
  saves: number;
  enquiries: number;
  leadRate: number;
  score: number;
};

export type RevenueHostOpportunity = {
  host_id: string;
  host_name: string | null;
  count: number;
  listings: number;
  types: RevenueSignalType[];
  views: number;
  enquiries: number;
};

export type RevenueMarketOpportunity = {
  city: string;
  count: number;
  types: RevenueSignalType[];
  views: number;
  enquiries: number;
};

export type RevenueReadiness = {
  signals: RevenueSignal[];
  listing: RevenueListingOpportunity[];
  host: RevenueHostOpportunity[];
  market: RevenueMarketOpportunity[];
  totals: {
    opportunities: number;
    listings: number;
    hosts: number;
    markets: number;
  };
};

export const REVENUE_SIGNAL_THRESHOLDS = {
  highDemandViews: 80,
  highDemandSaves: 6,
  lowConversionRate: 0.01,
  missedDemandMin: 10,
  featuredHighImpressions: 80,
  featuredHighLeads: 2,
  saleInterestViews: 60,
  saleInterestSaves: 6,
};

type ListingRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  owner_id?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  featured_at?: string | null;
  listing_intent?: string | null;
  paused_at?: string | null;
  status_updated_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function normalizeLeadRate(views: number, enquiries: number) {
  return enquiries / Math.max(views, 1);
}

function buildScore(summary: {
  views: number;
  saves: number;
  enquiries: number;
}) {
  return summary.views + summary.saves * 2 + summary.enquiries * 10;
}

export function classifyRevenueSignals({
  listing,
  summary,
  missedDemand,
  now,
}: {
  listing: ListingRow;
  summary: PropertyEventSummary;
  missedDemand: ReturnType<typeof estimateMissedDemand>;
  now: Date;
}): RevenueSignal[] {
  const signals: RevenueSignal[] = [];
  const views = summary.uniqueViews > 0 ? summary.uniqueViews : summary.views;
  const saves = Math.max(summary.netSaves, 0);
  const enquiries = summary.enquiries + summary.viewingRequests;
  const leadRate = normalizeLeadRate(views, enquiries);
  const featuredImpressions = summary.featuredImpressions;
  const featuredLeads = summary.featuredLeads;
  const baseMetrics = {
    views,
    saves,
    enquiries,
    leadRate,
    featuredImpressions,
    featuredLeads,
    missedDemand: missedDemand.state === "ok" ? missedDemand.missed : null,
  };

  if (
    listing.status === "live" &&
    !listing.is_featured &&
    (views >= REVENUE_SIGNAL_THRESHOLDS.highDemandViews ||
      saves >= REVENUE_SIGNAL_THRESHOLDS.highDemandSaves) &&
    (enquiries === 0 || leadRate < REVENUE_SIGNAL_THRESHOLDS.lowConversionRate)
  ) {
    signals.push({
      id: `low-conversion-${listing.id}`,
      type: "HIGH_DEMAND_LOW_CONVERSION",
      listing_id: listing.id,
      host_id: listing.owner_id ?? null,
      city: listing.city ?? null,
      title: listing.title ?? null,
      reason: `High interest (${views} views) but low conversion (${enquiries} enquiries).`,
      metrics: baseMetrics,
    });
  }

  if (
    listing.status &&
    listing.status.startsWith("paused") &&
    missedDemand.state === "ok" &&
    (missedDemand.missed ?? 0) >= REVENUE_SIGNAL_THRESHOLDS.missedDemandMin
  ) {
    signals.push({
      id: `paused-demand-${listing.id}`,
      type: "MISSED_DEMAND_WHILE_PAUSED",
      listing_id: listing.id,
      host_id: listing.owner_id ?? null,
      city: listing.city ?? null,
      title: listing.title ?? null,
      reason: `Paused listing is missing ~${missedDemand.missed} demand signals.`,
      metrics: baseMetrics,
    });
  }

  if (listing.featured_until && !listing.is_featured) {
    const featuredUntil = Date.parse(listing.featured_until);
    if (
      Number.isFinite(featuredUntil) &&
      featuredUntil < now.getTime() &&
      (featuredImpressions >= REVENUE_SIGNAL_THRESHOLDS.featuredHighImpressions ||
        featuredLeads >= REVENUE_SIGNAL_THRESHOLDS.featuredHighLeads)
    ) {
      signals.push({
        id: `featured-expired-${listing.id}`,
        type: "FEATURED_EXPIRED_HIGH_PERFORMANCE",
        listing_id: listing.id,
        host_id: listing.owner_id ?? null,
        city: listing.city ?? null,
        title: listing.title ?? null,
        reason: `Featured boost expired after strong results (${featuredImpressions} impressions).`,
        metrics: baseMetrics,
      });
    }
  }

  if (
    listing.listing_intent === "buy" &&
    views >= REVENUE_SIGNAL_THRESHOLDS.saleInterestViews &&
    (saves >= REVENUE_SIGNAL_THRESHOLDS.saleInterestSaves || enquiries > 0)
  ) {
    signals.push({
      id: `sale-interest-${listing.id}`,
      type: "HIGH_INTEREST_FOR_SALE",
      listing_id: listing.id,
      host_id: listing.owner_id ?? null,
      city: listing.city ?? null,
      title: listing.title ?? null,
      reason: `For-sale listing has high interest (${views} views, ${saves} saves).`,
      metrics: baseMetrics,
    });
  }

  return signals;
}

function mergeTypes(existing: RevenueSignalType[], next: RevenueSignalType) {
  if (existing.includes(next)) return existing;
  return [...existing, next];
}

export async function buildRevenueSignals({
  client,
  range,
}: {
  client: SupabaseClient;
  range: InsightsRange;
}): Promise<RevenueReadiness> {
  const { data, error } = await client
    .from("properties")
    .select(
      "id,title,city,status,owner_id,is_featured,featured_until,featured_at,listing_intent,paused_at,status_updated_at,expires_at,updated_at,created_at"
    )
    .order("updated_at", { ascending: false })
    .limit(400);

  if (error || !data) {
    return {
      signals: [],
      listing: [],
      host: [],
      market: [],
      totals: { opportunities: 0, listings: 0, hosts: 0, markets: 0 },
    };
  }

  const listings = (data as ListingRow[]) ?? [];
  if (listings.length === 0) {
    return {
      signals: [],
      listing: [],
      host: [],
      market: [],
      totals: { opportunities: 0, listings: 0, hosts: 0, markets: 0 },
    };
  }

  const propertyIds = listings.map((row) => row.id);
  const sinceDays = Math.max(range.days, 30);
  const eventResult = await fetchPropertyEvents({
    propertyIds,
    sinceDays,
    client,
  });

  const eventRows = eventResult.rows ?? [];
  const summaryMap = buildPropertyEventSummary(eventRows);
  const eventsByProperty = groupEventsByProperty(eventRows);
  const now = new Date();
  const signals: RevenueSignal[] = [];

  for (const listing of listings) {
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

    signals.push(
      ...classifyRevenueSignals({
        listing,
        summary,
        missedDemand,
        now,
      })
    );
  }

  const listingMap = new Map<string, RevenueListingOpportunity>();
  for (const signal of signals) {
    const entry = listingMap.get(signal.listing_id);
    if (!entry) {
      listingMap.set(signal.listing_id, {
        listing_id: signal.listing_id,
        title: signal.title,
        city: signal.city,
        host_id: signal.host_id,
        types: [signal.type],
        views: signal.metrics.views,
        saves: signal.metrics.saves,
        enquiries: signal.metrics.enquiries,
        leadRate: signal.metrics.leadRate,
        score: buildScore(signal.metrics),
      });
    } else {
      entry.types = mergeTypes(entry.types, signal.type);
      entry.views = Math.max(entry.views, signal.metrics.views);
      entry.saves = Math.max(entry.saves, signal.metrics.saves);
      entry.enquiries = Math.max(entry.enquiries, signal.metrics.enquiries);
      entry.leadRate = Math.max(entry.leadRate, signal.metrics.leadRate);
      entry.score = Math.max(entry.score, buildScore(signal.metrics));
    }
  }

  const listingOpportunities = Array.from(listingMap.values()).sort((a, b) => b.score - a.score);

  const hostMap = new Map<string, RevenueHostOpportunity>();
  for (const listing of listingOpportunities) {
    if (!listing.host_id) continue;
    const existing = hostMap.get(listing.host_id);
    if (!existing) {
      hostMap.set(listing.host_id, {
        host_id: listing.host_id,
        host_name: null,
        count: listing.types.length,
        listings: 1,
        types: [...listing.types],
        views: listing.views,
        enquiries: listing.enquiries,
      });
    } else {
      existing.count += listing.types.length;
      existing.listings += 1;
      existing.views += listing.views;
      existing.enquiries += listing.enquiries;
      listing.types.forEach((type) => {
        if (!existing.types.includes(type)) existing.types.push(type);
      });
    }
  }

  const hostIds = Array.from(hostMap.keys());
  if (hostIds.length) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id,full_name")
      .in("id", hostIds);
    for (const profile of (profiles as Array<{ id: string; full_name?: string | null }>) ?? []) {
      const host = hostMap.get(profile.id);
      if (host) host.host_name = profile.full_name ?? null;
    }
  }

  const hostOpportunities = Array.from(hostMap.values()).sort((a, b) => b.count - a.count);

  const marketMap = new Map<string, RevenueMarketOpportunity>();
  for (const listing of listingOpportunities) {
    if (!listing.city) continue;
    const city = listing.city;
    const existing = marketMap.get(city);
    if (!existing) {
      marketMap.set(city, {
        city,
        count: listing.types.length,
        types: [...listing.types],
        views: listing.views,
        enquiries: listing.enquiries,
      });
    } else {
      existing.count += listing.types.length;
      existing.views += listing.views;
      existing.enquiries += listing.enquiries;
      listing.types.forEach((type) => {
        if (!existing.types.includes(type)) existing.types.push(type);
      });
    }
  }

  const marketOpportunities = Array.from(marketMap.values()).sort((a, b) => b.count - a.count);

  return {
    signals,
    listing: listingOpportunities,
    host: hostOpportunities,
    market: marketOpportunities,
    totals: {
      opportunities: signals.length,
      listings: listingOpportunities.length,
      hosts: hostOpportunities.length,
      markets: marketOpportunities.length,
    },
  };
}
