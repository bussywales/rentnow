import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildExploreV2ConversionReport,
  fetchExploreV2ConversionRows,
  resolveExploreV2ConversionQuery,
  type ExploreV2ConversionMarketFilter,
  type ExploreV2ConversionIntentFilter,
  type ExploreV2ConversionMetricKey,
  type ExploreV2ConversionCtaCopyBreakdownRow,
  type ExploreV2ConversionTrustCueBreakdownRow,
} from "@/lib/explore/explore-v2-conversion-report";
import { AdminAnalyticsSectionNav } from "@/components/admin/AdminAnalyticsSectionNav";

export const dynamic = "force-dynamic";

type AdminExploreV2AnalyticsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const MARKET_OPTIONS: Array<{ value: ExploreV2ConversionMarketFilter; label: string }> = [
  { value: "ALL", label: "All markets" },
  { value: "NG", label: "NG" },
  { value: "GB", label: "GB" },
  { value: "CA", label: "CA" },
  { value: "US", label: "US" },
];

const INTENT_OPTIONS: Array<{ value: ExploreV2ConversionIntentFilter; label: string }> = [
  { value: "ALL", label: "All intents" },
  { value: "shortlet", label: "Shortlet" },
  { value: "rent", label: "Rent" },
  { value: "buy", label: "Buy" },
];

const KPI_LABELS: Array<{
  key: ExploreV2ConversionMetricKey;
  label: string;
  rateKey?: "primary_per_open" | "view_details_per_open" | "save_per_open" | "share_per_open";
}> = [
  { key: "sheet_opened", label: "Sheet opened" },
  { key: "primary_clicked", label: "Primary clicked", rateKey: "primary_per_open" },
  { key: "view_details_clicked", label: "View details", rateKey: "view_details_per_open" },
  { key: "save_clicked", label: "Save clicked", rateKey: "save_per_open" },
  { key: "share_clicked", label: "Share clicked", rateKey: "share_per_open" },
];

function pickSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(2)}%`;
}

function buildExportHref(input: {
  startDate: string;
  endDate: string;
  market: ExploreV2ConversionMarketFilter;
  intent: ExploreV2ConversionIntentFilter;
}) {
  const params = new URLSearchParams({
    start: input.startDate,
    end: input.endDate,
    market: input.market,
    intent: input.intent,
    format: "csv",
  });
  return `/api/admin/analytics/explore-v2?${params.toString()}`;
}

function isTrustCueRowActive(row: ExploreV2ConversionTrustCueBreakdownRow): boolean {
  return (
    row.sheet_opened > 0 ||
    row.primary_clicked > 0 ||
    row.view_details_clicked > 0 ||
    row.save_clicked > 0 ||
    row.share_clicked > 0
  );
}

function orderTrustCueRows(rows: ReadonlyArray<ExploreV2ConversionTrustCueBreakdownRow>) {
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const ordered: ExploreV2ConversionTrustCueBreakdownRow[] = [];
  const noneRow = rowsByKey.get("none");
  if (noneRow) ordered.push(noneRow);

  const instantRow = rowsByKey.get("instant_confirmation");
  if (instantRow) ordered.push(instantRow);

  const unknownRow = rowsByKey.get("unknown");
  if (unknownRow && isTrustCueRowActive(unknownRow)) {
    ordered.push(unknownRow);
  }

  return ordered;
}

function isCtaCopyRowActive(row: ExploreV2ConversionCtaCopyBreakdownRow): boolean {
  return (
    row.sheet_opened > 0 ||
    row.primary_clicked > 0 ||
    row.view_details_clicked > 0 ||
    row.save_clicked > 0 ||
    row.share_clicked > 0
  );
}

function orderCtaCopyRows(rows: ReadonlyArray<ExploreV2ConversionCtaCopyBreakdownRow>) {
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const ordered: ExploreV2ConversionCtaCopyBreakdownRow[] = [];

  const defaultRow = rowsByKey.get("default");
  if (defaultRow) ordered.push(defaultRow);

  const clarityRow = rowsByKey.get("clarity");
  if (clarityRow) ordered.push(clarityRow);

  const actionRow = rowsByKey.get("action");
  if (actionRow) ordered.push(actionRow);

  const unknownRow = rowsByKey.get("unknown");
  if (unknownRow && isCtaCopyRowActive(unknownRow)) {
    ordered.push(unknownRow);
  }

  return ordered;
}

export default async function AdminExploreV2AnalyticsPage({
  searchParams,
}: AdminExploreV2AnalyticsPageProps) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/analytics/explore-v2&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const query = resolveExploreV2ConversionQuery({
    date: pickSearchParam(searchParams, "date"),
    start: pickSearchParam(searchParams, "start"),
    end: pickSearchParam(searchParams, "end"),
    market: pickSearchParam(searchParams, "market"),
    intent: pickSearchParam(searchParams, "intent"),
  });

  const dataClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const rows = await fetchExploreV2ConversionRows({
    client: dataClient,
    startIso: query.range.startIso,
    endIso: query.range.endIso,
    market: query.market,
    intent: query.intent,
    limit: 50000,
  });
  const report = buildExploreV2ConversionReport({
    rows,
    range: query.range,
    market: query.market,
    intent: query.intent,
  });
  const exportHref = buildExportHref({
    startDate: report.range.startDate,
    endDate: report.range.endDate,
    market: report.market,
    intent: report.intent,
  });
  const hasData = rows.length > 0;
  const trustCueRows = orderTrustCueRows(report.by_trust_cue_variant);
  const ctaCopyRows = orderCtaCopyRows(report.by_cta_copy_variant);

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6"
      data-testid="admin-explore-v2-conversion-page"
    >
      <section className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <h1 className="text-2xl font-semibold">Explore V2 conversion</h1>
        <p className="mt-1 text-sm text-slate-200">
          Consent-gated micro-sheet funnel metrics for `sheet_opened`, primary CTA, details, save, and share actions.
        </p>
        <p className="mt-1 text-xs text-slate-300">
          Scope: this report covers Explore V2 micro-sheet interactions only. Rail-level save/share events are excluded.
        </p>
        <p className="mt-2 text-xs text-cyan-100">
          Range: {report.range.startDate} → {report.range.endDate}
        </p>
      </section>

      <AdminAnalyticsSectionNav current="explore_v2" />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/admin/analytics/explore-v2" method="get" className="grid gap-3 md:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Start
            <input
              type="date"
              name="start"
              defaultValue={report.range.startDate}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            End
            <input
              type="date"
              name="end"
              defaultValue={report.range.endDate}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Market
            <select
              name="market"
              defaultValue={report.market}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {MARKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Intent
            <select
              name="intent"
              defaultValue={report.intent}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {INTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"
              data-testid="admin-explore-v2-conversion-apply"
            >
              Apply
            </button>
            <Link
              href={exportHref}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              data-testid="admin-explore-v2-conversion-export"
            >
              Export CSV
            </Link>
          </div>
        </form>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        data-testid="admin-explore-v2-conversion-kpis"
      >
        {KPI_LABELS.map((metric) => (
          <article key={metric.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{report.totals[metric.key]}</p>
            {metric.rateKey ? (
              <p className="mt-1 text-xs text-slate-500">{formatRate(report.rates[metric.rateKey])} of opens</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Baseline funnel event</p>
            )}
          </article>
        ))}
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="admin-explore-v2-conversion-trust-cue"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">Trust cue experiment</h2>
          <p className="text-xs text-slate-600">
            Compare conversion from `sheet_opened` by trust cue variant. Older rows without `trust_cue_variant` are
            grouped as Unknown.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-2 py-2">Variant</th>
                <th className="px-2 py-2">Opens</th>
                <th className="px-2 py-2">Primary clicks</th>
                <th className="px-2 py-2">Primary CTR</th>
                <th className="px-2 py-2">View details CTR</th>
              </tr>
            </thead>
            <tbody>
              {trustCueRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-2 py-2">{row.sheet_opened}</td>
                  <td className="px-2 py-2">{row.primary_clicked}</td>
                  <td className="px-2 py-2">{formatRate(row.primary_per_open)}</td>
                  <td className="px-2 py-2">{formatRate(row.view_details_per_open)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="admin-explore-v2-conversion-cta-copy"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">CTA copy experiment</h2>
          <p className="text-xs text-slate-600">
            Compare conversion from `sheet_opened` by CTA copy variant. Older rows without `ctaCopyVariant` are
            grouped as Unknown.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-2 py-2">Variant</th>
                <th className="px-2 py-2">Opens</th>
                <th className="px-2 py-2">Primary clicks</th>
                <th className="px-2 py-2">Primary CTR</th>
                <th className="px-2 py-2">View details CTR</th>
              </tr>
            </thead>
            <tbody>
              {ctaCopyRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-2 py-2">{row.sheet_opened}</td>
                  <td className="px-2 py-2">{row.primary_clicked}</td>
                  <td className="px-2 py-2">{formatRate(row.primary_per_open)}</td>
                  <td className="px-2 py-2">{formatRate(row.view_details_per_open)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!hasData && (
        <section
          className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600"
          data-testid="admin-explore-v2-conversion-empty"
        >
          No data yet for this filter set. Events appear only when analytics consent is granted and Explore V2 micro-sheet
          actions occur. Rail-level save/share interactions are not included in this funnel.
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">By day</h2>
          <div className="mt-3 overflow-x-auto" data-testid="admin-explore-v2-conversion-by-day">
            <table className="min-w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Opens</th>
                  <th className="px-2 py-2">Primary</th>
                  <th className="px-2 py-2">Details</th>
                  <th className="px-2 py-2">Save</th>
                  <th className="px-2 py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {report.by_day.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">{row.date}</td>
                    <td className="px-2 py-2">{row.sheet_opened}</td>
                    <td className="px-2 py-2">{row.primary_clicked}</td>
                    <td className="px-2 py-2">{row.view_details_clicked}</td>
                    <td className="px-2 py-2">{row.save_clicked}</td>
                    <td className="px-2 py-2">{row.share_clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">By market</h2>
          <div className="mt-3 overflow-x-auto" data-testid="admin-explore-v2-conversion-by-market">
            <table className="min-w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-2 py-2">Market</th>
                  <th className="px-2 py-2">Opens</th>
                  <th className="px-2 py-2">Primary</th>
                </tr>
              </thead>
              <tbody>
                {report.by_market.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">{row.label}</td>
                    <td className="px-2 py-2">{row.sheet_opened}</td>
                    <td className="px-2 py-2">{row.primary_clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">By intent</h2>
          <div className="mt-3 overflow-x-auto" data-testid="admin-explore-v2-conversion-by-intent">
            <table className="min-w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-2 py-2">Intent</th>
                  <th className="px-2 py-2">Opens</th>
                  <th className="px-2 py-2">Primary</th>
                </tr>
              </thead>
              <tbody>
                {report.by_intent.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">{row.label}</td>
                    <td className="px-2 py-2">{row.sheet_opened}</td>
                    <td className="px-2 py-2">{row.primary_clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
