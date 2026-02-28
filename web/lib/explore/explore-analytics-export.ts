import type { ExploreAnalyticsEvent } from "@/lib/explore/explore-analytics";

export const EXPLORE_ANALYTICS_EXPORT_COLUMNS = [
  "timestamp",
  "sessionId",
  "eventName",
  "listingId",
  "market",
  "intent",
  "index",
  "feedSize",
  "action",
  "result",
] as const;

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function buildExploreAnalyticsCsv(events: ReadonlyArray<ExploreAnalyticsEvent>): string {
  const lines = [
    EXPLORE_ANALYTICS_EXPORT_COLUMNS.join(","),
    ...events.map((event) =>
      [
        event.at,
        event.sessionId ?? "",
        event.name,
        event.listingId ?? "",
        event.marketCode ?? event.marketCountry ?? "",
        event.intentType ?? "",
        normalizeCsvValue(event.index),
        normalizeCsvValue(event.feedSize),
        event.action ?? "",
        event.result ?? "",
      ]
        .map((value) => escapeCsvValue(normalizeCsvValue(value)))
        .join(",")
    ),
  ];
  return lines.join("\n");
}
