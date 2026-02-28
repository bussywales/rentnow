import type { ExploreAnalyticsCounters } from "@/lib/explore/explore-analytics.server";

type ExploreAnalyticsDashboardProps = {
  counters: ExploreAnalyticsCounters;
  totalEvents: number;
  rangeLabel: string;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function ExploreAnalyticsDashboard({
  counters,
  totalEvents,
  rangeLabel,
}: ExploreAnalyticsDashboardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-explore-analytics-dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Explore funnel counters</h2>
          <p className="mt-1 text-xs text-slate-500">{rangeLabel}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          Total events: {totalEvents}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Views" value={counters.views} />
        <StatCard label="Swipes" value={counters.swipes} />
        <StatCard label="Details opens" value={counters.detailsOpens} />
        <StatCard label="CTA taps" value={counters.ctaTaps} />
        <StatCard label="Request attempts" value={counters.requestAttempts} />
        <StatCard label="Request success" value={counters.requestSuccess} />
        <StatCard label="Request fail" value={counters.requestFail} />
      </div>
    </section>
  );
}
