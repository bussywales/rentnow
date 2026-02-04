import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightsRange } from "@/lib/admin/insights";
import { fetchPropertyEvents, groupEventsByProperty } from "@/lib/analytics/property-events.server";

export type InsightsActionType =
  | "LOW_VISIBILITY"
  | "MISSED_DEMAND"
  | "FEATURED_EXPIRING"
  | "SUPPLY_GAP";

export type InsightsActionCta = {
  label: string;
  href?: string;
  action?: "FEATURE" | "REACTIVATE" | "EXTEND";
};

export type InsightsAction = {
  id: string;
  type: InsightsActionType;
  title: string;
  description: string;
  property_id?: string;
  city?: string;
  featured_rank?: number | null;
  cta: InsightsActionCta[];
};

export type ListingActionInput = {
  id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  featured_rank: number | null;
  paused_at: string | null;
  views_range: number;
  saves_range: number;
  enquiries_range: number;
  pre_pause_views: number;
  pre_pause_enquiries: number;
  paused_views: number;
};

export type SupplyGap = {
  city: string;
  views: number;
  liveListings: number;
  viewsPerListing: number;
};

export const ACTION_THRESHOLDS = {
  highViews: 50,
  highSaves: 5,
  supplyGapMinViews: 80,
  supplyGapMinRatio: 12,
  supplyGapMaxListings: 12,
  featuredExpiringDays: 3,
  missedDemandLookbackDays: 14,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string | null) {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function buildSupplyGaps(listings: ListingActionInput[]): SupplyGap[] {
  const cityViews = new Map<string, number>();
  const citySupply = new Map<string, number>();

  for (const listing of listings) {
    const city = listing.city?.trim();
    if (!city) continue;
    cityViews.set(city, (cityViews.get(city) ?? 0) + listing.views_range);
    if (listing.status === "live") {
      citySupply.set(city, (citySupply.get(city) ?? 0) + 1);
    }
  }

  const gaps: SupplyGap[] = [];
  for (const [city, views] of cityViews.entries()) {
    const supply = citySupply.get(city) ?? 0;
    const ratio = views / Math.max(supply, 1);
    if (
      views >= ACTION_THRESHOLDS.supplyGapMinViews &&
      ratio >= ACTION_THRESHOLDS.supplyGapMinRatio &&
      supply <= ACTION_THRESHOLDS.supplyGapMaxListings
    ) {
      gaps.push({ city, views, liveListings: supply, viewsPerListing: ratio });
    }
  }

  gaps.sort((a, b) => b.viewsPerListing - a.viewsPerListing);
  return gaps.slice(0, 3);
}

export function resolveInsightsActions({
  listings,
  supplyGaps,
  rangeKey,
  now,
}: {
  listings: ListingActionInput[];
  supplyGaps: SupplyGap[];
  rangeKey: string;
  now: Date;
}): InsightsAction[] {
  const actions: InsightsAction[] = [];
  const nowMs = now.getTime();
  const expiringCutoff = nowMs + ACTION_THRESHOLDS.featuredExpiringDays * DAY_MS;

  for (const listing of listings) {
    const title = listing.title?.trim() || "Untitled listing";
    const isLive = listing.status === "live";
    const isPaused = listing.status?.startsWith("paused");

    if (
      isLive &&
      !listing.is_featured &&
      listing.enquiries_range === 0 &&
      (listing.views_range >= ACTION_THRESHOLDS.highViews ||
        listing.saves_range >= ACTION_THRESHOLDS.highSaves)
    ) {
      actions.push({
        id: `low-visibility-${listing.id}`,
        type: "LOW_VISIBILITY",
        title: "High demand, low visibility",
        description: `${title} has ${formatCount(listing.views_range)} views and ${
          listing.saves_range
        } saves but no enquiries.`,
        property_id: listing.id,
        city: listing.city ?? undefined,
        cta: [
          { label: "Feature listing", action: "FEATURE" },
          {
            label: "View listing",
            href: `/admin/listings?property=${encodeURIComponent(listing.id)}`,
          },
        ],
      });
    }

    if (isPaused) {
      const hadDemandBeforePause = listing.pre_pause_views > 0 || listing.pre_pause_enquiries > 0;
      const missedViews = Math.max(listing.paused_views, listing.pre_pause_views);
      if (hadDemandBeforePause) {
        actions.push({
          id: `missed-demand-${listing.id}`,
          type: "MISSED_DEMAND",
          title: "Missed demand while paused",
          description: `${title} had ${
            listing.pre_pause_views
          } recent views before pausing. Missed ~${formatCount(
            missedViews
          )} views while paused.`,
          property_id: listing.id,
          city: listing.city ?? undefined,
          cta: [
            { label: "Reactivate listing", action: "REACTIVATE" },
            {
              label: "View listing",
              href: `/admin/listings?property=${encodeURIComponent(listing.id)}`,
            },
          ],
        });
      }
    }

    if (listing.is_featured && listing.featured_until) {
      const untilTs = parseDate(listing.featured_until);
      if (untilTs && untilTs <= expiringCutoff && untilTs >= nowMs) {
        actions.push({
          id: `featured-expiring-${listing.id}`,
          type: "FEATURED_EXPIRING",
          title: "Featured expiring soon",
          description: `${title} expires on ${new Date(untilTs).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          )}.`,
          property_id: listing.id,
          city: listing.city ?? undefined,
          featured_rank: listing.featured_rank,
          cta: [
            { label: "Extend feature", action: "EXTEND" },
            {
              label: "View performance",
              href: `/admin/listings?property=${encodeURIComponent(listing.id)}`,
            },
          ],
        });
      }
    }
  }

  for (const gap of supplyGaps) {
    actions.push({
      id: `supply-gap-${gap.city.toLowerCase().replace(/\s+/g, "-")}`,
      type: "SUPPLY_GAP",
      title: "Supply gap by location",
      description: `${gap.city}: ${formatCount(gap.views)} views vs ${
        gap.liveListings
      } live listings.`,
      city: gap.city,
      cta: [
        {
          label: "Recruit hosts",
          href: `/admin/insights?range=${rangeKey}#markets`,
        },
      ],
    });
  }

  const priority: Record<InsightsActionType, number> = {
    FEATURED_EXPIRING: 1,
    MISSED_DEMAND: 2,
    LOW_VISIBILITY: 3,
    SUPPLY_GAP: 4,
  };

  actions.sort((a, b) => priority[a.type] - priority[b.type]);
  return actions.slice(0, 6);
}

type ListingRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  featured_rank?: number | null;
  paused_at?: string | null;
};

export async function buildInsightsActions({
  client,
  range,
}: {
  client: SupabaseClient;
  range: InsightsRange;
}): Promise<InsightsAction[]> {
  const { data, error } = await client
    .from("properties")
    .select("id,title,city,status,is_featured,featured_until,featured_rank,paused_at")
    .order("updated_at", { ascending: false })
    .limit(400);

  if (error || !data) return [];

  const listings = (data as ListingRow[]) ?? [];
  if (!listings.length) return [];

  const propertyIds = listings.map((row) => row.id);
  const sinceDays = Math.max(range.days, ACTION_THRESHOLDS.missedDemandLookbackDays);
  const { rows } = await fetchPropertyEvents({
    propertyIds,
    sinceDays,
    client,
  });

  const grouped = groupEventsByProperty(rows);
  const rangeStart = Date.parse(range.start);
  const rangeEnd = Date.parse(range.end);
  const now = new Date();

  const listingInputs: ListingActionInput[] = listings.map((listing) => {
    const events = grouped.get(listing.id) ?? [];
    let viewsRange = 0;
    let enquiriesRange = 0;
    let savesRange = 0;
    let saveAdds = 0;
    let saveRemoves = 0;
    let prePauseViews = 0;
    let prePauseEnquiries = 0;
    let pausedViews = 0;
    const pauseTs = parseDate(listing.paused_at);
    const prePauseStart = pauseTs ? pauseTs - ACTION_THRESHOLDS.missedDemandLookbackDays * DAY_MS : null;

    for (const event of events) {
      if (!event.occurred_at) continue;
      const ts = Date.parse(event.occurred_at);
      if (Number.isNaN(ts)) continue;

      const inRange = ts >= rangeStart && ts < rangeEnd;
      const beforePauseWindow =
        pauseTs && prePauseStart !== null ? ts >= prePauseStart && ts < pauseTs : false;

      if (event.event_type === "property_view") {
        if (inRange) viewsRange += 1;
        if (pauseTs && ts >= pauseTs) pausedViews += 1;
        if (beforePauseWindow) prePauseViews += 1;
      }

      if (event.event_type === "lead_created" || event.event_type === "viewing_requested") {
        if (inRange) enquiriesRange += 1;
        if (beforePauseWindow) prePauseEnquiries += 1;
      }

      if (event.event_type === "save_toggle" && inRange) {
        const action = event.meta?.action;
        if (action === "save") saveAdds += 1;
        if (action === "unsave") saveRemoves += 1;
      }
    }

    savesRange = Math.max(0, saveAdds - saveRemoves);

    return {
      id: listing.id,
      title: listing.title ?? null,
      city: listing.city ?? null,
      status: listing.status ?? null,
      is_featured: listing.is_featured ?? null,
      featured_until: listing.featured_until ?? null,
      featured_rank: listing.featured_rank ?? null,
      paused_at: listing.paused_at ?? null,
      views_range: viewsRange,
      saves_range: savesRange,
      enquiries_range: enquiriesRange,
      pre_pause_views: prePauseViews,
      pre_pause_enquiries: prePauseEnquiries,
      paused_views: pausedViews,
    };
  });

  const supplyGaps = buildSupplyGaps(listingInputs);

  return resolveInsightsActions({
    listings: listingInputs,
    supplyGaps,
    rangeKey: range.key,
    now,
  });
}
