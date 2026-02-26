import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { buildAdminDiscoveryHealthSnapshot } from "@/lib/admin/discovery-health";

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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-discovery-invalid-list">
        <h2 className="text-sm font-semibold text-slate-900">Invalid and filtered entries</h2>
        <p className="mt-1 text-xs text-slate-500">
          Entries rejected by validation or filtered by disabled/validity windows.
        </p>
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
