import Link from "next/link";
import { redirect } from "next/navigation";
import type { InsightsRangeKey } from "@/lib/admin/insights";
import { buildAdminInsights, resolveInsightsRange } from "@/lib/admin/insights";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type InsightsDiagnostics = {
  supabaseReady: boolean;
  serviceRoleReady: boolean;
  insights: Awaited<ReturnType<typeof buildAdminInsights>> | null;
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

async function getInsightsDiagnostics(rangeKey: string): Promise<InsightsDiagnostics> {
  if (!hasServerSupabaseEnv()) {
    return {
      supabaseReady: false,
      serviceRoleReady: false,
      insights: null,
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
      error: "Service role key missing; insights unavailable.",
    };
  }

  const adminClient = createServiceRoleClient();
  const range = resolveInsightsRange(rangeKey);
  const insights = await buildAdminInsights(adminClient, range);

  return {
    supabaseReady: true,
    serviceRoleReady,
    insights,
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
  const diag = await getInsightsDiagnostics(rangeKey);
  const insights = diag.insights;

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

      {diag.supabaseReady && diag.serviceRoleReady && insights && (
        <>
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
