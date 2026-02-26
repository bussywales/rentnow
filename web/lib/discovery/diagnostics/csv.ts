import type { HealthIssue } from "@/lib/admin/discovery-health";
import type {
  DiscoveryCoverageSummary,
  DiscoveryCoverageRow,
} from "@/lib/discovery/diagnostics/coverage";
import type { BrokenRouteIssue } from "@/lib/discovery/diagnostics/broken-routes";

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  const normalized = value == null ? "" : String(value);
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>): string {
  const headerLine = headers.map((header) => escapeCsvValue(header)).join(",");
  const bodyLines = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","));
  return [headerLine, ...bodyLines].join("\n");
}

function coverageRowToCsvRow(row: DiscoveryCoverageRow): Array<string | number | boolean> {
  return [
    row.market,
    row.surface,
    row.threshold,
    row.availableCount,
    row.marketSpecificCount,
    row.coverageScore,
    row.deficit,
    row.atRisk,
  ];
}

export function buildCoverageSummaryCsv(summary: DiscoveryCoverageSummary): string {
  return buildCsv(
    [
      "market",
      "surface",
      "threshold",
      "available_count",
      "market_specific_count",
      "coverage_score",
      "deficit",
      "at_risk",
    ],
    summary.rows.map((row) => coverageRowToCsvRow(row))
  );
}

export function buildInvalidEntriesCsv(items: ReadonlyArray<HealthIssue>): string {
  return buildCsv(
    ["source", "id", "reason_codes", "details"],
    items.map((item) => [
      item.source,
      item.id ?? "",
      item.reasonCodes.join("|"),
      item.details,
    ])
  );
}

export function buildBrokenRoutesCsv(items: ReadonlyArray<BrokenRouteIssue>): string {
  return buildCsv(
    ["source", "id", "route_label", "reason_code", "href", "details"],
    items.map((item) => [
      item.source,
      item.id,
      item.routeLabel,
      item.reasonCode,
      item.href,
      item.details,
    ])
  );
}
