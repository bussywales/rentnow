import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveExploreAnalyticsRange, type ExploreAnalyticsRange } from "@/lib/explore/explore-analytics.server";

export const EXPLORE_V2_CONVERSION_EVENT_NAMES = [
  "explore_v2_cta_sheet_opened",
  "explore_v2_cta_primary_clicked",
  "explore_v2_cta_view_details_clicked",
  "explore_v2_cta_save_clicked",
  "explore_v2_cta_share_clicked",
] as const;

export type ExploreV2ConversionEventName = (typeof EXPLORE_V2_CONVERSION_EVENT_NAMES)[number];
export type ExploreV2ConversionMarketFilter = "ALL" | "NG" | "GB" | "CA" | "US";
export type ExploreV2ConversionIntentFilter = "ALL" | "shortlet" | "rent" | "buy";
export type ExploreV2ConversionFormat = "json" | "csv";
export type ExploreV2ConversionMetricKey =
  | "sheet_opened"
  | "primary_clicked"
  | "view_details_clicked"
  | "save_clicked"
  | "share_clicked";

export type ExploreV2ConversionRow = {
  created_at: string;
  event_name: ExploreV2ConversionEventName;
  listing_id: string | null;
  market_code: string | null;
  intent_type: "shortlet" | "rent" | "buy" | null;
  trust_cue_variant?: "none" | "instant_confirmation" | null;
  trust_cue_enabled?: boolean | null;
  cta_copy_variant?: "default" | "clarity" | "action" | null;
};

export type ExploreV2ConversionTotals = Record<ExploreV2ConversionMetricKey, number>;

export type ExploreV2ConversionRateSummary = {
  primary_per_open: number | null;
  view_details_per_open: number | null;
  save_per_open: number | null;
  share_per_open: number | null;
};

export type ExploreV2ConversionBreakdownRow = {
  key: string;
  label: string;
} & ExploreV2ConversionTotals;

export type ExploreV2ConversionTrustCueBreakdownRow = ExploreV2ConversionBreakdownRow & {
  primary_per_open: number | null;
  view_details_per_open: number | null;
};

export type ExploreV2ConversionCtaCopyBreakdownRow = ExploreV2ConversionBreakdownRow & {
  primary_per_open: number | null;
  view_details_per_open: number | null;
};

export type ExploreV2ConversionDayBreakdownRow = {
  date: string;
} & ExploreV2ConversionTotals;

export type ExploreV2ConversionReport = {
  range: ExploreAnalyticsRange;
  market: ExploreV2ConversionMarketFilter;
  intent: ExploreV2ConversionIntentFilter;
  totals: ExploreV2ConversionTotals;
  rates: ExploreV2ConversionRateSummary;
  by_day: ExploreV2ConversionDayBreakdownRow[];
  by_market: ExploreV2ConversionBreakdownRow[];
  by_intent: ExploreV2ConversionBreakdownRow[];
  by_trust_cue_variant: ExploreV2ConversionTrustCueBreakdownRow[];
  by_cta_copy_variant: ExploreV2ConversionCtaCopyBreakdownRow[];
};

export type ExploreV2ConversionQuery = {
  range: ExploreAnalyticsRange;
  market: ExploreV2ConversionMarketFilter;
  intent: ExploreV2ConversionIntentFilter;
  format: ExploreV2ConversionFormat;
};

const EVENT_TO_METRIC: Record<ExploreV2ConversionEventName, ExploreV2ConversionMetricKey> = {
  explore_v2_cta_sheet_opened: "sheet_opened",
  explore_v2_cta_primary_clicked: "primary_clicked",
  explore_v2_cta_view_details_clicked: "view_details_clicked",
  explore_v2_cta_save_clicked: "save_clicked",
  explore_v2_cta_share_clicked: "share_clicked",
};

const ALLOWED_MARKETS = new Set<ExploreV2ConversionMarketFilter>(["ALL", "NG", "GB", "CA", "US"]);
const ALLOWED_INTENTS = new Set<ExploreV2ConversionIntentFilter>(["ALL", "shortlet", "rent", "buy"]);

function parseMarketFilter(value: string | null | undefined): ExploreV2ConversionMarketFilter {
  const normalized = (value || "").trim().toUpperCase();
  if (ALLOWED_MARKETS.has(normalized as ExploreV2ConversionMarketFilter)) {
    return normalized as ExploreV2ConversionMarketFilter;
  }
  return "ALL";
}

function parseIntentFilter(value: string | null | undefined): ExploreV2ConversionIntentFilter {
  const normalized = (value || "").trim().toLowerCase();
  if (ALLOWED_INTENTS.has(normalized as ExploreV2ConversionIntentFilter)) {
    return normalized as ExploreV2ConversionIntentFilter;
  }
  return "ALL";
}

function parseFormat(value: string | null | undefined): ExploreV2ConversionFormat {
  return (value || "").trim().toLowerCase() === "csv" ? "csv" : "json";
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function cloneTotals(): ExploreV2ConversionTotals {
  return {
    sheet_opened: 0,
    primary_clicked: 0,
    view_details_clicked: 0,
    save_clicked: 0,
    share_clicked: 0,
  };
}

function toRate(value: number, opened: number): number | null {
  if (opened <= 0) return null;
  return Number(((value / opened) * 100).toFixed(2));
}

function toMarketBucket(value: string | null): string {
  const code = (value || "").trim().toUpperCase();
  if (code === "NG" || code === "GB" || code === "CA" || code === "US") return code;
  return "UNKNOWN";
}

function toIntentBucket(value: string | null): string {
  const intent = (value || "").trim().toLowerCase();
  if (intent === "shortlet" || intent === "rent" || intent === "buy") return intent;
  return "unknown";
}

function toTrustCueVariantBucket(value: string | null | undefined): "none" | "instant_confirmation" | "unknown" {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "none") return "none";
  if (normalized === "instant_confirmation") return "instant_confirmation";
  return "unknown";
}

function toTrustCueVariantLabel(value: string): string {
  if (value === "instant_confirmation") return "Instant confirmation";
  if (value === "none") return "None";
  return "Unknown";
}

function toCtaCopyVariantBucket(value: string | null | undefined): "default" | "clarity" | "action" | "unknown" {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "clarity") return "clarity";
  if (normalized === "action") return "action";
  if (normalized === "default") return "default";
  return "unknown";
}

function toCtaCopyVariantLabel(value: string): string {
  if (value === "clarity") return "Clarity";
  if (value === "action") return "Action";
  if (value === "default") return "Default";
  return "Unknown";
}

function buildDateSeries(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    days.push(toIsoDate(cursor));
  }
  return days;
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function resolveExploreV2ConversionQuery(input: {
  date?: string | null;
  start?: string | null;
  end?: string | null;
  market?: string | null;
  intent?: string | null;
  format?: string | null;
  now?: Date;
}): ExploreV2ConversionQuery {
  return {
    range: resolveExploreAnalyticsRange({
      date: input.date,
      start: input.start,
      end: input.end,
      now: input.now,
    }),
    market: parseMarketFilter(input.market),
    intent: parseIntentFilter(input.intent),
    format: parseFormat(input.format),
  };
}

export async function fetchExploreV2ConversionRows(input: {
  client: SupabaseClient;
  startIso: string;
  endIso: string;
  market: ExploreV2ConversionMarketFilter;
  intent: ExploreV2ConversionIntentFilter;
  limit?: number;
}): Promise<ExploreV2ConversionRow[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 10000, 50000));
  let query = input.client
    .from("explore_events")
    .select(
      "created_at,event_name,listing_id,market_code,intent_type,trust_cue_variant,trust_cue_enabled,cta_copy_variant"
    )
    .in("event_name", [...EXPLORE_V2_CONVERSION_EVENT_NAMES])
    .gte("created_at", input.startIso)
    .lte("created_at", input.endIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (input.market !== "ALL") {
    query = query.eq("market_code", input.market);
  }
  if (input.intent !== "ALL") {
    query = query.eq("intent_type", input.intent);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data as ExploreV2ConversionRow[] | null) ?? [];
}

export function buildExploreV2ConversionReport(input: {
  rows: ReadonlyArray<ExploreV2ConversionRow>;
  range: ExploreAnalyticsRange;
  market: ExploreV2ConversionMarketFilter;
  intent: ExploreV2ConversionIntentFilter;
}): ExploreV2ConversionReport {
  const totals = cloneTotals();
  const byDayMap = new Map<string, ExploreV2ConversionTotals>();
  const byMarketMap = new Map<string, ExploreV2ConversionTotals>();
  const byIntentMap = new Map<string, ExploreV2ConversionTotals>();
  const byTrustCueVariantMap = new Map<string, ExploreV2ConversionTotals>();
  const byCtaCopyVariantMap = new Map<string, ExploreV2ConversionTotals>();
  const dateSeries = buildDateSeries(input.range.startDate, input.range.endDate);

  for (const day of dateSeries) {
    byDayMap.set(day, cloneTotals());
  }

  byMarketMap.set("NG", cloneTotals());
  byMarketMap.set("GB", cloneTotals());
  byMarketMap.set("CA", cloneTotals());
  byMarketMap.set("US", cloneTotals());

  byIntentMap.set("shortlet", cloneTotals());
  byIntentMap.set("rent", cloneTotals());
  byIntentMap.set("buy", cloneTotals());
  byTrustCueVariantMap.set("none", cloneTotals());
  byTrustCueVariantMap.set("instant_confirmation", cloneTotals());
  byCtaCopyVariantMap.set("default", cloneTotals());
  byCtaCopyVariantMap.set("clarity", cloneTotals());
  byCtaCopyVariantMap.set("action", cloneTotals());

  for (const row of input.rows) {
    const metric = EVENT_TO_METRIC[row.event_name];
    totals[metric] += 1;

    const dayKey = row.created_at.slice(0, 10);
    if (!byDayMap.has(dayKey)) {
      byDayMap.set(dayKey, cloneTotals());
    }
    byDayMap.get(dayKey)![metric] += 1;

    const marketKey = toMarketBucket(row.market_code);
    if (!byMarketMap.has(marketKey)) {
      byMarketMap.set(marketKey, cloneTotals());
    }
    byMarketMap.get(marketKey)![metric] += 1;

    const intentKey = toIntentBucket(row.intent_type);
    if (!byIntentMap.has(intentKey)) {
      byIntentMap.set(intentKey, cloneTotals());
    }
    byIntentMap.get(intentKey)![metric] += 1;

    const trustCueKey = toTrustCueVariantBucket(row.trust_cue_variant);
    if (!byTrustCueVariantMap.has(trustCueKey)) {
      byTrustCueVariantMap.set(trustCueKey, cloneTotals());
    }
    byTrustCueVariantMap.get(trustCueKey)![metric] += 1;

    const ctaCopyKey = toCtaCopyVariantBucket(row.cta_copy_variant);
    if (!byCtaCopyVariantMap.has(ctaCopyKey)) {
      byCtaCopyVariantMap.set(ctaCopyKey, cloneTotals());
    }
    byCtaCopyVariantMap.get(ctaCopyKey)![metric] += 1;
  }

  const by_day: ExploreV2ConversionDayBreakdownRow[] = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  const by_market: ExploreV2ConversionBreakdownRow[] = [...byMarketMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, counts]) => ({
      key,
      label: key === "UNKNOWN" ? "Unknown" : key,
      ...counts,
    }));

  const by_intent: ExploreV2ConversionBreakdownRow[] = [...byIntentMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, counts]) => ({
      key,
      label: key === "unknown" ? "Unknown" : key,
      ...counts,
    }));

  const by_trust_cue_variant: ExploreV2ConversionTrustCueBreakdownRow[] = [...byTrustCueVariantMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, counts]) => ({
      key,
      label: toTrustCueVariantLabel(key),
      ...counts,
      primary_per_open: toRate(counts.primary_clicked, counts.sheet_opened),
      view_details_per_open: toRate(counts.view_details_clicked, counts.sheet_opened),
    }));
  const by_cta_copy_variant: ExploreV2ConversionCtaCopyBreakdownRow[] = [...byCtaCopyVariantMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, counts]) => ({
      key,
      label: toCtaCopyVariantLabel(key),
      ...counts,
      primary_per_open: toRate(counts.primary_clicked, counts.sheet_opened),
      view_details_per_open: toRate(counts.view_details_clicked, counts.sheet_opened),
    }));

  return {
    range: input.range,
    market: input.market,
    intent: input.intent,
    totals,
    rates: {
      primary_per_open: toRate(totals.primary_clicked, totals.sheet_opened),
      view_details_per_open: toRate(totals.view_details_clicked, totals.sheet_opened),
      save_per_open: toRate(totals.save_clicked, totals.sheet_opened),
      share_per_open: toRate(totals.share_clicked, totals.sheet_opened),
    },
    by_day,
    by_market,
    by_intent,
    by_trust_cue_variant,
    by_cta_copy_variant,
  };
}

export function buildExploreV2ConversionCsv(rows: ReadonlyArray<ExploreV2ConversionRow>): string {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const date = row.created_at.slice(0, 10);
    const market = toMarketBucket(row.market_code);
    const intent = toIntentBucket(row.intent_type);
    const trustCueVariant = toTrustCueVariantBucket(row.trust_cue_variant);
    const key = `${date}|${market}|${intent}|${trustCueVariant}|${row.event_name}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  const lines = ["date,market,intent,trust_cue_variant,event_name,count"];
  for (const [key, count] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [date, market, intent, trustCueVariant, eventName] = key.split("|");
    lines.push(
      [date, market, intent, trustCueVariant, eventName, String(count)]
        .map((value) => escapeCsvValue(value))
        .join(",")
    );
  }
  return lines.join("\n");
}
