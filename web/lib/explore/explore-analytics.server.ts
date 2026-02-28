import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExploreAnalyticsEvent, ExploreAnalyticsEventName } from "@/lib/explore/explore-analytics";

export type ExploreAnalyticsRow = {
  created_at: string;
  event_name: ExploreAnalyticsEventName;
  session_id: string | null;
  listing_id: string | null;
  market_code: string | null;
  intent_type: "shortlet" | "rent" | "buy" | null;
  slide_index: number | null;
  feed_size: number | null;
};

export type ExploreAnalyticsRange = {
  startIso: string;
  endIso: string;
  startDate: string;
  endDate: string;
  label: string;
};

function parseDateOnly(value: string | null | undefined): string | null {
  const trimmed = (value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function startOfDayIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function endOfDayIso(day: string): string {
  return `${day}T23:59:59.999Z`;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function resolveExploreAnalyticsRange(input: {
  date?: string | null;
  start?: string | null;
  end?: string | null;
  now?: Date;
}): ExploreAnalyticsRange {
  const now = input.now ?? new Date();
  const date = parseDateOnly(input.date);
  if (date) {
    return {
      startIso: startOfDayIso(date),
      endIso: endOfDayIso(date),
      startDate: date,
      endDate: date,
      label: `Day: ${date}`,
    };
  }

  const start = parseDateOnly(input.start);
  const end = parseDateOnly(input.end);
  if (start && end && start <= end) {
    return {
      startIso: startOfDayIso(start),
      endIso: endOfDayIso(end),
      startDate: start,
      endDate: end,
      label: `${start} → ${end}`,
    };
  }

  const endDefault = toIsoDate(now);
  const startDefaultDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  const startDefault = toIsoDate(startDefaultDate);
  return {
    startIso: startOfDayIso(startDefault),
    endIso: endOfDayIso(endDefault),
    startDate: startDefault,
    endDate: endDefault,
    label: `Last 7 days (${startDefault} → ${endDefault})`,
  };
}

export async function fetchExploreAnalyticsRows(input: {
  client: SupabaseClient;
  startIso: string;
  endIso: string;
  limit?: number;
}): Promise<ExploreAnalyticsRow[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 10000, 50000));
  const { data, error } = await input.client
    .from("explore_events")
    .select("created_at,event_name,session_id,listing_id,market_code,intent_type,slide_index,feed_size")
    .gte("created_at", input.startIso)
    .lte("created_at", input.endIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data as ExploreAnalyticsRow[] | null) ?? [];
}

export type ExploreAnalyticsCounters = {
  views: number;
  swipes: number;
  detailsOpens: number;
  ctaTaps: number;
  requestAttempts: number;
  requestSuccess: number;
  requestFail: number;
};

export function buildExploreAnalyticsCounters(rows: ReadonlyArray<ExploreAnalyticsRow>): ExploreAnalyticsCounters {
  const counts: ExploreAnalyticsCounters = {
    views: 0,
    swipes: 0,
    detailsOpens: 0,
    ctaTaps: 0,
    requestAttempts: 0,
    requestSuccess: 0,
    requestFail: 0,
  };

  for (const row of rows) {
    switch (row.event_name) {
      case "explore_view":
        counts.views += 1;
        break;
      case "explore_swipe":
        counts.swipes += 1;
        break;
      case "explore_open_details":
        counts.detailsOpens += 1;
        break;
      case "explore_tap_cta":
        counts.ctaTaps += 1;
        break;
      case "explore_submit_request_attempt":
        counts.requestAttempts += 1;
        break;
      case "explore_submit_request_success":
        counts.requestSuccess += 1;
        break;
      case "explore_submit_request_fail":
        counts.requestFail += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

export function toExploreAnalyticsEvents(rows: ReadonlyArray<ExploreAnalyticsRow>): ExploreAnalyticsEvent[] {
  return rows.map((row) => ({
    name: row.event_name,
    at: row.created_at,
    sessionId: row.session_id,
    listingId: row.listing_id,
    marketCode: row.market_code,
    marketCountry: row.market_code,
    intentType: row.intent_type,
    index: row.slide_index ?? undefined,
    feedSize: row.feed_size ?? undefined,
  }));
}
