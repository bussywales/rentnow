import Link from "next/link";
import type { AnalyticsRangeKey, HostAnalyticsSnapshot, KpiMetric } from "@/lib/analytics/landlord-analytics";

const RANGE_LABELS: Array<{ key: AnalyticsRangeKey; label: string }> = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
];

const formatMetricValue = (metric: KpiMetric) => {
  if (!metric.available || metric.value === null) return "Not available";
  if (metric.unit === "percent") return `${metric.value}%`;
  if (metric.unit === "hours") return `${metric.value.toFixed(1)}h`;
  return metric.value.toLocaleString();
};

const formatDelta = (metric: KpiMetric) => {
  if (!metric.available || metric.delta === null) return "Not available";
  const sign = metric.delta > 0 ? "+" : metric.delta < 0 ? "" : "";
  if (metric.unit === "percent") return `${sign}${metric.delta}%`;
  if (metric.unit === "hours") return `${sign}${metric.delta.toFixed(1)}h`;
  return `${sign}${metric.delta}`;
};

const formatDirection = (direction: KpiMetric["direction"]) => {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  if (direction === "flat") return "■";
  return "•";
};

const coverageLabel = (available: boolean) => (available ? "Available" : "Not available");

const coverageTone = (available: boolean) =>
  available ? "text-emerald-700" : "text-amber-700";

export function HostAnalyticsPanel({
  snapshot,
  rangeKey,
  baseHref,
  title,
  showDiagnostics = false,
}: {
  snapshot: HostAnalyticsSnapshot;
  rangeKey: AnalyticsRangeKey;
  baseHref: string;
  title: string;
  showDiagnostics?: boolean;
}) {
  const emptyListings = snapshot.totalListings === 0;
  const coverage = snapshot.availability;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">Read-only marketplace health for your listings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_LABELS.map((option) => (
            <Link
              key={option.key}
              href={`${baseHref}?range=${option.key}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                rangeKey === option.key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {emptyListings && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No listings yet. Publish your first listing to unlock analytics insights.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active listings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {snapshot.activeListings ?? "Not available"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Total: {snapshot.totalListings ?? "n/a"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Range</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{snapshot.range.label}</p>
          <p className="mt-1 text-xs text-slate-500">Compared to previous period.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Last updated</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {new Date(snapshot.lastUpdated).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.values(snapshot.kpis).map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMetricValue(metric)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDirection(metric.direction)} {formatDelta(metric)} vs previous period
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Data coverage</p>
          <p className="text-xs text-slate-600">Coverage reflects whether each signal is tracked.</p>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Listing views</span>
              <span className={coverageTone(coverage.views)}>{coverageLabel(coverage.views)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Saved by tenants</span>
              <span className={coverageTone(coverage.saves)}>{coverageLabel(coverage.saves)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Enquiries</span>
              <span className={coverageTone(coverage.enquiries)}>{coverageLabel(coverage.enquiries)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Viewing requests</span>
              <span className={coverageTone(coverage.viewings)}>{coverageLabel(coverage.viewings)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Response performance</p>
          <p className="text-xs text-slate-600">
            Metrics are computed from message threads initiated by tenants.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Response rate</span>
              <span className={coverageTone(coverage.responseRate)}>
                {formatMetricValue(snapshot.kpis.responseRate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Median response time</span>
              <span className={coverageTone(coverage.responseTime)}>
                {formatMetricValue(snapshot.kpis.medianResponseTime)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showDiagnostics && snapshot.notes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Some metrics are unavailable: {snapshot.notes.join(" · ")}
        </div>
      )}
    </div>
  );
}
