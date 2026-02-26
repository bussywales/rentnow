import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { buildAdminDiscoveryHealthSnapshot } from "@/lib/admin/discovery-health";
import {
  buildBrokenRoutesCsv,
  buildCoverageSummaryCsv,
  buildInvalidEntriesCsv,
} from "@/lib/discovery/diagnostics/csv";

export const dynamic = "force-dynamic";

type MetricCardProps = {
  label: string;
  value: number;
  tone?: "default" | "warn";
};

function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  const toneClasses =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-900";
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClasses}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function toCsvHref(csv: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function AdminDiscoveryPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/discovery&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const snapshot = buildAdminDiscoveryHealthSnapshot();
  const coverageCsvHref = toCsvHref(buildCoverageSummaryCsv(snapshot.coverage));
  const invalidCsvHref = toCsvHref(buildInvalidEntriesCsv(snapshot.invalidEntries));
  const brokenCsvHref = toCsvHref(buildBrokenRoutesCsv(snapshot.brokenRoutes.items));
  const coverageSurfaces = Array.from(new Set(snapshot.coverage.rows.map((row) => row.surface)));
  const coverageMarkets = Array.from(new Set(snapshot.coverage.rows.map((row) => row.market)));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6" data-testid="admin-discovery-health">
      <section className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <h1 className="text-2xl font-semibold">Discovery catalogue diagnostics</h1>
        <p className="mt-1 text-sm text-slate-200">
          Read-only health checks for market taxonomy coverage and routing safety.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-200">
          <p>
            Generated: <span className="font-medium">{snapshot.generatedAt}</span>
          </p>
          <p>
            Commit: <span className="font-medium">{snapshot.build.commitSha?.slice(0, 8) ?? "unknown"}</span>
          </p>
          <p>
            Version: <span className="font-medium">{snapshot.build.version}</span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-discovery-summary">
        <h2 className="text-sm font-semibold text-slate-900">Validation summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-discovery-total-count">
          <MetricCard label="Discovery valid" value={snapshot.discovery.validCount} />
          <MetricCard label="Discovery invalid" value={snapshot.discovery.invalidCount} tone="warn" />
          <MetricCard label="Collections valid" value={snapshot.collections.validCount} />
          <MetricCard label="Collections invalid" value={snapshot.collections.invalidCount} tone="warn" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Discovery disabled" value={snapshot.discovery.disabledCount} />
          <MetricCard label="Discovery expired" value={snapshot.discovery.expiredCount} />
          <MetricCard label="Discovery not yet active" value={snapshot.discovery.notYetActiveCount} />
          <MetricCard label="Collections disabled" value={snapshot.collections.disabledCount} />
          <MetricCard label="Collections expired" value={snapshot.collections.expiredCount} />
          <MetricCard label="Collections not yet active" value={snapshot.collections.notYetActiveCount} />
        </div>
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="admin-discovery-coverage-panel"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Coverage score</h2>
            <p className="mt-1 text-xs text-slate-500">
              Threshold-based readiness for NG, CA, GB, and US plus global fallback depth.
            </p>
          </div>
          <a
            href={coverageCsvHref}
            download="discovery-coverage-summary.csv"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="admin-discovery-export-coverage"
          >
            Export coverage CSV
          </a>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Overall coverage score" value={snapshot.coverage.overallCoverageScore} />
          <MetricCard label="Rows below threshold" value={snapshot.coverage.topRisks.length} tone="warn" />
          <MetricCard
            label="Broken routes detected"
            value={snapshot.brokenRoutes.totalCount}
            tone={snapshot.brokenRoutes.totalCount > 0 ? "warn" : "default"}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Market
                </th>
                {coverageSurfaces.map((surface) => (
                  <th
                    key={surface}
                    className="px-3 py-2 text-left font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    {surface}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Market score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coverageMarkets.map((market) => (
                <tr key={market}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{market}</td>
                  {coverageSurfaces.map((surface) => {
                    const row = snapshot.coverage.rows.find(
                      (candidate) => candidate.market === market && candidate.surface === surface
                    );
                    if (!row) {
                      return (
                        <td key={`${market}-${surface}`} className="px-3 py-2 text-slate-500">
                          —
                        </td>
                      );
                    }
                    return (
                      <td key={`${market}-${surface}`} className="px-3 py-2 text-slate-700">
                        <span className="font-semibold text-slate-900">{row.availableCount}</span> /{" "}
                        {row.threshold}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            row.atRisk ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.coverageScore}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 font-semibold text-slate-900">{snapshot.coverage.byMarketScore[market]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="admin-discovery-market-breakdown"
        >
          <h2 className="text-sm font-semibold text-slate-900">Coverage by market</h2>
          <p className="mt-1 text-xs text-slate-500">Counts include discovery items and valid collections coverage.</p>
          <dl className="mt-3 divide-y divide-slate-100">
            {Object.entries(snapshot.counts.markets).map(([market, value]) => (
              <div key={market} className="flex items-center justify-between py-2 text-sm">
                <dt className="font-medium text-slate-700">{market}</dt>
                <dd className="font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="admin-discovery-surface-breakdown"
        >
          <h2 className="text-sm font-semibold text-slate-900">Coverage by surface</h2>
          <p className="mt-1 text-xs text-slate-500">Home, shortlets, properties, and collections catalogues.</p>
          <dl className="mt-3 divide-y divide-slate-100">
            {Object.entries(snapshot.counts.surfaces).map(([surface, value]) => (
              <div key={surface} className="flex items-center justify-between py-2 text-sm">
                <dt className="font-medium text-slate-700">{surface}</dt>
                <dd className="font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-discovery-routing-checks">
          <h2 className="text-sm font-semibold text-slate-900">Routing sanity checks</h2>
          <p className="mt-1 text-xs text-slate-500">Static checks for missing route-driving params by item type.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Discovery broken routing" value={snapshot.discovery.brokenRoutingCount} tone="warn" />
            <MetricCard label="Collections broken routing" value={snapshot.collections.brokenRoutingCount} tone="warn" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-discovery-reason-codes">
          <h2 className="text-sm font-semibold text-slate-900">Reason code totals</h2>
          <p className="mt-1 text-xs text-slate-500">Most frequent validator reasons across discovery and collections.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[...snapshot.discovery.reasonCounts, ...snapshot.collections.reasonCounts]
              .slice(0, 10)
              .map((entry) => (
                <li
                  key={`${entry.reasonCode}-${entry.count}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="font-mono text-xs text-slate-700">{entry.reasonCode}</span>
                  <span className="font-semibold text-slate-900">{entry.count}</span>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="admin-discovery-top-risks"
        >
          <h2 className="text-sm font-semibold text-slate-900">Top risks</h2>
          <p className="mt-1 text-xs text-slate-500">
            Market/surface combinations currently below threshold.
          </p>
          {snapshot.coverage.topRisks.length === 0 ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              No risks detected. All market surfaces meet baseline thresholds.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.coverage.topRisks.map((risk) => (
                <li
                  key={`${risk.market}-${risk.surface}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <p className="font-semibold text-amber-900">
                    {risk.market} · {risk.surface}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Available {risk.availableCount}/{risk.threshold} (deficit {risk.deficit}).
                    Market-specific depth: {risk.marketSpecificCount}.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="admin-discovery-broken-routes"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Broken route/param audit</h2>
              <p className="mt-1 text-xs text-slate-500">
                Static audit across featured rails and collection CTAs.
              </p>
            </div>
            <a
              href={brokenCsvHref}
              download="discovery-broken-routes.csv"
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              data-testid="admin-discovery-export-broken"
            >
              Export broken routes CSV
            </a>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Total broken routes" value={snapshot.brokenRoutes.totalCount} tone="warn" />
            <MetricCard label="Reason codes" value={snapshot.brokenRoutes.reasonCounts.length} />
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {snapshot.brokenRoutes.reasonCounts.slice(0, 6).map((entry) => (
              <li
                key={`${entry.reasonCode}-${entry.count}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="font-mono text-xs text-slate-700">{entry.reasonCode}</span>
                <span className="font-semibold text-slate-900">{entry.count}</span>
              </li>
            ))}
          </ul>
          {snapshot.brokenRoutes.items.length > 0 ? (
            <details className="mt-3 rounded-lg border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                View broken route entries ({snapshot.brokenRoutes.items.length})
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {snapshot.brokenRoutes.items.slice(0, 40).map((issue) => (
                  <li
                    key={`${issue.source}-${issue.id}-${issue.routeLabel}-${issue.reasonCode}-${issue.href}`}
                    className="rounded border border-slate-200 px-2 py-2"
                  >
                    <p className="font-semibold text-slate-800">
                      {issue.source.toUpperCase()} · {issue.id} · {issue.routeLabel}
                    </p>
                    <p className="font-mono text-[11px] text-slate-700">{issue.reasonCode}</p>
                    <p className="truncate text-[11px] text-slate-500">{issue.href}</p>
                    <p className="text-[11px] text-slate-500">{issue.details}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              No broken routes detected.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-discovery-invalid-list">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invalid and filtered entries</h2>
            <p className="mt-1 text-xs text-slate-500">
              Entries rejected by validation or filtered by disabled/validity windows.
            </p>
          </div>
          <a
            href={invalidCsvHref}
            download="discovery-invalid-entries.csv"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="admin-discovery-export-invalid"
          >
            Export invalid entries CSV
          </a>
        </div>
        {snapshot.invalidEntries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            No invalid entries detected.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.invalidEntries.slice(0, 40).map((entry) => (
              <li
                key={`${entry.source}-${entry.id ?? "unknown"}-${entry.details}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {entry.source.toUpperCase()} · {entry.id ?? "unknown"}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-700">{entry.reasonCodes.join(", ")}</p>
                <p className="mt-1 text-xs text-slate-500">{entry.details}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
