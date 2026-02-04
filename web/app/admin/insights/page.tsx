import Link from "next/link";
import { redirect } from "next/navigation";
import type { InsightsRangeKey } from "@/lib/admin/insights";
import { buildAdminInsights, resolveInsightsRange } from "@/lib/admin/insights";
import { buildInsightsActions } from "@/lib/admin/insights-actions.server";
import { buildInsightsDrilldowns } from "@/lib/admin/insights-drilldowns";
import { buildRevenueSignals } from "@/lib/admin/revenue-signals.server";
import { buildRevenueFunnel } from "@/lib/admin/revenue-funnels.server";
import { getSupplyHealth } from "@/lib/admin/supply-health.server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import AdminInsightsActions from "@/components/admin/AdminInsightsActions";
import InsightsListingHealthClient from "@/components/admin/InsightsListingHealthClient";
import InsightsSupplyHealthClient from "@/components/admin/InsightsSupplyHealthClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type InsightsDiagnostics = {
  supabaseReady: boolean;
  serviceRoleReady: boolean;
  insights: Awaited<ReturnType<typeof buildAdminInsights>> | null;
  actions: Awaited<ReturnType<typeof buildInsightsActions>> | null;
  revenueSignals: Awaited<ReturnType<typeof buildRevenueSignals>> | null;
  revenueFunnel: Awaited<ReturnType<typeof buildRevenueFunnel>> | null;
  drilldowns: Awaited<ReturnType<typeof buildInsightsDrilldowns>> | null;
  supplyHealth: Awaited<ReturnType<typeof getSupplyHealth>> | null;
  error: string | null;
};

const RANGE_OPTIONS: Array<{ key: InsightsRangeKey; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

function parseParam(params: SearchParams, key: string) {
  const value = params[key];
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function formatNumber(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString();
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value}%`;
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return value.toFixed(2);
}

async function getInsightsDiagnostics({
  rangeKey,
  funnelRole,
  funnelIntent,
  funnelMarket,
}: {
  rangeKey: string;
  funnelRole: "tenant" | "host";
  funnelIntent: string;
  funnelMarket: string;
}): Promise<InsightsDiagnostics> {
  if (!hasServerSupabaseEnv()) {
    return {
      supabaseReady: false,
      serviceRoleReady: false,
      insights: null,
      actions: null,
      revenueSignals: null,
      revenueFunnel: null,
      drilldowns: null,
      supplyHealth: null,
      error: "Supabase env vars missing.",
    };
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/insights&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const serviceRoleReady = hasServiceRoleEnv();
  if (!serviceRoleReady) {
    return {
      supabaseReady: true,
      serviceRoleReady,
      insights: null,
      actions: null,
      revenueSignals: null,
      revenueFunnel: null,
      drilldowns: null,
      supplyHealth: null,
      error: "Service role key missing; insights unavailable.",
    };
  }

  const adminClient = createServiceRoleClient();
  const range = resolveInsightsRange(rangeKey);
  const insights = await buildAdminInsights(adminClient, range);
  const actions = await buildInsightsActions({ client: adminClient, range });
  const revenueSignals = await buildRevenueSignals({ client: adminClient, range });
  const revenueFunnel = await buildRevenueFunnel({
    client: adminClient,
    range,
    role: funnelRole,
    intent: funnelIntent || null,
    market: funnelMarket || null,
  });
  const drilldowns = await buildInsightsDrilldowns(adminClient, range);
  const supplyHealth = await getSupplyHealth({ client: adminClient, rangeDays: range.days });

  return {
    supabaseReady: true,
    serviceRoleReady,
    insights,
    actions,
    revenueSignals,
    revenueFunnel,
    drilldowns,
    supplyHealth,
    error: insights.notes.length ? insights.notes.join(" | ") : null,
  };
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number | null; max: number | null }) {
  const safeValue = value ?? 0;
  const percent = max && max > 0 ? Math.round((safeValue / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{formatNumber(value)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-800"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default async function AdminInsightsPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedParams = searchParams ? await searchParams : {};
  const rangeKey = parseParam(resolvedParams, "range");
  const statusParam = parseParam(resolvedParams, "status");
  const flagParam = parseParam(resolvedParams, "flag");
  const queryParam = parseParam(resolvedParams, "q");
  const funnelRoleParam = parseParam(resolvedParams, "funnel");
  const funnelIntentParam = parseParam(resolvedParams, "intent");
  const funnelMarketParam = parseParam(resolvedParams, "market");
  const funnelRole = funnelRoleParam === "host" ? "host" : "tenant";
  const funnelIntent = funnelIntentParam || "";
  const funnelMarket = funnelMarketParam || "";
  const diag = await getInsightsDiagnostics({
    rangeKey,
    funnelRole,
    funnelIntent,
    funnelMarket,
  });
  const insights = diag.insights;
  const actions = diag.actions;
  const revenueSignals = diag.revenueSignals;
  const revenueFunnel = diag.revenueFunnel;
  const drilldowns = diag.drilldowns;
  const supplyHealth = diag.supplyHealth;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>
          <p className="text-sm text-slate-600">
            Growth, engagement, and marketplace health at a glance. Read-only.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((option) => {
            const active = insights?.range.key === option.key;
            return (
              <Link
                key={option.key}
                href={`/admin/insights?range=${option.key}`}
                data-testid={`insights-range-${option.key}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!diag.supabaseReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase is not configured; insights are unavailable.
        </div>
      )}

      {diag.supabaseReady && !diag.serviceRoleReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Service role key missing; insights are unavailable until it is configured.
        </div>
      )}

      {diag.supabaseReady &&
        diag.serviceRoleReady &&
        insights &&
        drilldowns &&
        supplyHealth &&
        actions &&
        revenueSignals &&
        revenueFunnel && (
        <>
          <AdminInsightsActions actions={actions} />
          <section className="space-y-4" data-testid="insights-revenue-readiness">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Revenue readiness</h2>
              <p className="text-sm text-slate-600">
                Monetisation opportunities derived from demand, featured performance, and paused
                listings.
              </p>
            </div>
            {revenueSignals.signals.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                No revenue opportunities detected in this range.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Opportunities</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatNumber(revenueSignals.totals.opportunities)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Listings with signals: {formatNumber(revenueSignals.totals.listings)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Top listings</p>
                  <div className="mt-3 space-y-2">
                    {revenueSignals.listing.slice(0, 5).map((listing) => (
                      <div key={listing.listing_id} className="text-sm">
                        <p className="font-semibold text-slate-900">
                          {listing.title || "Untitled listing"}
                        </p>
                        <p className="text-xs text-slate-600">
                          {listing.city || "Unknown"} · {listing.types.join(", ").toLowerCase()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Top hosts</p>
                  <div className="mt-3 space-y-2">
                    {revenueSignals.host.slice(0, 3).map((host) => (
                      <div key={host.host_id} className="text-sm">
                        <p className="font-semibold text-slate-900">
                          {host.host_name || host.host_id}
                        </p>
                        <p className="text-xs text-slate-600">
                          {host.count} signals · {host.listings} listings
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              )}
            </section>
          <section className="space-y-4" data-testid="insights-revenue-funnels">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Revenue funnels</h2>
                <p className="text-sm text-slate-600">
                  Conversion journey by role, intent, and market for the selected range.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/insights?range=${insights.range.key}&funnel=tenant&intent=${encodeURIComponent(
                    funnelIntent
                  )}&market=${encodeURIComponent(funnelMarket)}`}
                  data-testid="insights-funnel-tab-tenant"
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    funnelRole === "tenant"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Tenants
                </Link>
                <Link
                  href={`/admin/insights?range=${insights.range.key}&funnel=host&intent=${encodeURIComponent(
                    funnelIntent
                  )}&market=${encodeURIComponent(funnelMarket)}`}
                  data-testid="insights-funnel-tab-host"
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    funnelRole === "host"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Hosts
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {RANGE_OPTIONS.map((option) => {
                const active = insights.range.key === option.key;
                return (
                  <Link
                    key={`funnel-${option.key}`}
                    href={`/admin/insights?range=${option.key}&funnel=${funnelRole}&intent=${encodeURIComponent(
                      funnelIntent
                    )}&market=${encodeURIComponent(funnelMarket)}`}
                    data-testid={`insights-funnel-range-${option.key}`}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      active ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="range" value={insights.range.key} />
              <input type="hidden" name="funnel" value={funnelRole} />
              {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
              {flagParam ? <input type="hidden" name="flag" value={flagParam} /> : null}
              {queryParam ? <input type="hidden" name="q" value={queryParam} /> : null}
              <label className="text-xs text-slate-600">
                Intent
                <select
                  name="intent"
                  defaultValue={funnelIntent}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">All</option>
                  <option value="rent">Rent</option>
                  <option value="sale">Sale</option>
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Market
                <input
                  name="market"
                  defaultValue={funnelMarket}
                  placeholder="City"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <button
                type="submit"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              >
                Apply
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                {revenueFunnel.steps.map((step) => (
                  <div key={step.key} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{step.label}</span>
                      <span className="text-slate-700">{formatNumber(step.count)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-800"
                        style={{ width: `${step.conversion ?? 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {step.conversion === null
                        ? "Baseline"
                        : `${step.conversion}% from previous step`}
                    </p>
                  </div>
                ))}
              </div>
              {revenueFunnel.meta?.highIntentThreshold ? (
                <p className="mt-3 text-xs text-slate-500">
                  High-intent host threshold: ≥{Math.round(revenueFunnel.meta.highIntentThreshold)} views per listing.
                </p>
              ) : null}
            </div>
          </section>
          <section className="space-y-4" data-testid="insights-growth">
            <h2 className="text-xl font-semibold text-slate-900">Top-line growth</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard label="Visitors (daily)" value={formatNumber(insights.topLine.visitorsDaily)} />
              <KpiCard label="Visitors (weekly)" value={formatNumber(insights.topLine.visitorsWeekly)} />
              <KpiCard label="Visitors (monthly)" value={formatNumber(insights.topLine.visitorsMonthly)} />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard label="Total signups" value={formatNumber(insights.topLine.totalSignups)} />
              <KpiCard label="New tenants" value={formatNumber(insights.topLine.newTenants)} />
              <KpiCard label="New hosts/agents" value={formatNumber(insights.topLine.newHostsAgents)} />
              <KpiCard label="Active users (weekly)" value={formatNumber(insights.topLine.activeUsersWeekly)} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard label="Active users (daily)" value={formatNumber(insights.topLine.activeUsersDaily)} />
              <KpiCard label="Active users (weekly)" value={formatNumber(insights.topLine.activeUsersWeekly)} />
              <KpiCard label="Active users (monthly)" value={formatNumber(insights.topLine.activeUsersMonthly)} />
            </div>
          </section>

          <section className="space-y-4" data-testid="insights-marketplace">
            <h2 className="text-xl font-semibold text-slate-900">Marketplace health</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard label="Live listings" value={formatNumber(insights.marketplace.liveListings)} />
              <KpiCard label="Paused listings" value={formatNumber(insights.marketplace.pausedListings)} />
              <KpiCard label="Expired listings" value={formatNumber(insights.marketplace.expiredListings)} />
              <KpiCard label="New listings" value={formatNumber(insights.marketplace.newListings)} />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard label="Views" value={formatNumber(insights.marketplace.views)} />
              <KpiCard label="Enquiries" value={formatNumber(insights.marketplace.enquiries)} />
              <KpiCard label="Views per listing" value={formatRate(insights.marketplace.viewsPerListing)} />
              <KpiCard label="Enquiries per listing" value={formatRate(insights.marketplace.enquiriesPerListing)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <KpiCard
                label="Zero-view listings (7d)"
                value={formatPercent(insights.marketplace.zeroViewsPct7d)}
                hint="Share of live listings with no views in the last 7 days."
              />
              <KpiCard
                label="Zero-enquiry listings (14d)"
                value={formatPercent(insights.marketplace.zeroEnquiriesPct14d)}
                hint="Share of live listings with no enquiries in the last 14 days."
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" data-testid="insights-activation">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Tenant activation</h2>
              <p className="text-sm text-slate-600">
                Search/browse to contact funnel (views tagged from search or tenant home).
              </p>
              <div className="mt-4 space-y-4">
                <FunnelRow
                  label="Search or browse"
                  value={insights.activation.tenant.searches}
                  max={insights.activation.tenant.searches}
                />
                <FunnelRow
                  label="Views"
                  value={insights.activation.tenant.views}
                  max={insights.activation.tenant.searches}
                />
                <FunnelRow
                  label="Saves"
                  value={insights.activation.tenant.saves}
                  max={insights.activation.tenant.searches}
                />
                <FunnelRow
                  label="Contacts"
                  value={insights.activation.tenant.contacts}
                  max={insights.activation.tenant.searches}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Host activation</h2>
              <p className="text-sm text-slate-600">Listing lifecycle to first demand signal.</p>
              <div className="mt-4 space-y-4">
                <FunnelRow
                  label="Listings created"
                  value={insights.activation.host.created}
                  max={insights.activation.host.created}
                />
                <FunnelRow
                  label="Published"
                  value={insights.activation.host.published}
                  max={insights.activation.host.created}
                />
                <FunnelRow
                  label="First view"
                  value={insights.activation.host.firstView}
                  max={insights.activation.host.created}
                />
                <FunnelRow
                  label="First enquiry"
                  value={insights.activation.host.firstEnquiry}
                  max={insights.activation.host.created}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4" data-testid="insights-revenue">
            <h2 className="text-xl font-semibold text-slate-900">Revenue readiness signals</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard label="Featured impressions" value={formatNumber(insights.revenue.featuredImpressions)} />
              <KpiCard label="Featured clicks" value={formatNumber(insights.revenue.featuredClicks)} />
              <KpiCard label="Featured CTR" value={formatPercent(insights.revenue.featuredCtr)} />
              <KpiCard label="Featured enquiries" value={formatNumber(insights.revenue.featuredEnquiries)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <KpiCard
                label="Missed demand while paused"
                value={formatNumber(insights.revenue.missedDemand)}
                hint="Estimated demand signals while listings were paused or expired."
              />
              <KpiCard
                label="Listing reactivations"
                value={formatNumber(insights.revenue.reactivations)}
                hint="Listings reactivated in this period."
              />
            </div>
          </section>

          <section className="space-y-4" data-testid="insights-alerts">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Alerts & Opportunities</h2>
                <p className="text-sm text-slate-600">
                  Actionable items derived from the selected range.
                </p>
              </div>
            </div>
            {drilldowns.alerts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                No alerts triggered for this range.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {drilldowns.alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    data-testid={`insights-alert-${alert.id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          alert.severity === "critical"
                            ? "bg-rose-100 text-rose-700"
                            : alert.severity === "warn"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{alert.description}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-900">{alert.count} affected</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4" id="markets" data-testid="insights-markets">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Markets performance</h2>
                <p className="text-sm text-slate-600">
                  Top cities by visitors, views, and enquiries.
                </p>
              </div>
              <a href="#markets-all" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                View all
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Market</th>
                      <th className="px-4 py-3 text-right font-semibold">Visitors</th>
                      <th className="px-4 py-3 text-right font-semibold">Views</th>
                      <th className="px-4 py-3 text-right font-semibold">Enquiries</th>
                      <th className="px-4 py-3 text-right font-semibold">Views → Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldowns.markets.top.map((row) => (
                      <tr key={row.city}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.city}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.visitors)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.views)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.enquiries)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Emerging markets</h3>
              <p className="text-xs text-slate-600">Fastest growth versus the previous period.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {drilldowns.markets.emerging.map((row) => (
                  <div key={row.city} className="rounded-xl border border-slate-200 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">{row.city}</p>
                    <p className="text-xs text-slate-600">
                      Views growth: {formatPercent(row.viewsGrowthPct ?? null)} · Leads growth:{" "}
                      {formatPercent(row.enquiriesGrowthPct ?? null)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <details id="markets-all" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">All markets</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Market</th>
                      <th className="px-4 py-3 text-right font-semibold">Visitors</th>
                      <th className="px-4 py-3 text-right font-semibold">Views</th>
                      <th className="px-4 py-3 text-right font-semibold">Enquiries</th>
                      <th className="px-4 py-3 text-right font-semibold">Views → Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldowns.markets.all.map((row) => (
                      <tr key={`all-${row.city}`}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.city}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.visitors)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.views)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.enquiries)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="space-y-4" id="listing-health" data-testid="insights-listing-health">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Listing health scoreboard</h2>
              <p className="text-sm text-slate-600">Operational listing flags and quick actions.</p>
            </div>
            <InsightsListingHealthClient
              initialRows={drilldowns.listingHealth}
              initialStatus={statusParam}
              initialFlag={flagParam}
              initialQuery={queryParam}
            />
          </section>

          <section className="space-y-4" id="supply-health" data-testid="insights-supply-health">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Supply health</h2>
              <p className="text-sm text-slate-600">
                Quality scoring highlights listings that need basic improvements.
              </p>
            </div>
            <InsightsSupplyHealthClient initialRows={supplyHealth.rows} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2" data-testid="insights-cohorts">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Tenant activation cohorts</h2>
              <p className="text-sm text-slate-600">Signup → view → save → enquiry.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Cohort</th>
                      <th className="px-4 py-3 text-right font-semibold">Signed up</th>
                      <th className="px-4 py-3 text-right font-semibold">Viewed</th>
                      <th className="px-4 py-3 text-right font-semibold">Saved</th>
                      <th className="px-4 py-3 text-right font-semibold">Enquired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldowns.tenantCohorts.map((bucket) => (
                      <tr key={bucket.label}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{bucket.label}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.signedUp)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.viewed)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.saved)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.enquired)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Host activation cohorts</h2>
              <p className="text-sm text-slate-600">Signup → create → submit → live → first lead.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Cohort</th>
                      <th className="px-4 py-3 text-right font-semibold">Signed up</th>
                      <th className="px-4 py-3 text-right font-semibold">Created</th>
                      <th className="px-4 py-3 text-right font-semibold">Submitted</th>
                      <th className="px-4 py-3 text-right font-semibold">Live</th>
                      <th className="px-4 py-3 text-right font-semibold">First view</th>
                      <th className="px-4 py-3 text-right font-semibold">First lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldowns.hostCohorts.map((bucket) => (
                      <tr key={bucket.label}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{bucket.label}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.signedUp)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.createdListing ?? null)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.submittedReview ?? null)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.listingLive ?? null)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.firstView ?? null)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumber(bucket.receivedLead ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {diag.error && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Diagnostics: {diag.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
