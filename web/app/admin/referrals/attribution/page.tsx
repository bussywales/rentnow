import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import { getAdminReferralAttributionOverview } from "@/lib/referrals/share-tracking.server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/referrals/attribution&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return {
    client: hasServiceRoleEnv()
      ? (createServiceRoleClient() as unknown as SupabaseClient)
      : (supabase as unknown as SupabaseClient),
  };
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

function readParam(params: SearchParams | undefined, key: string) {
  if (!params) return "";
  const value = params[key];
  if (Array.isArray(value)) return value[value.length - 1] ?? "";
  return value ?? "";
}

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

async function resolveSearchParams(raw?: SearchParams | Promise<SearchParams>) {
  if (raw && typeof (raw as { then?: unknown }).then === "function") {
    return (raw as Promise<SearchParams>);
  }
  return raw ?? {};
}

export default async function AdminReferralAttributionPage({ searchParams: rawSearchParams }: Props) {
  const { client } = await requireAdmin();
  const searchParams = await resolveSearchParams(rawSearchParams);
  const windowRaw = readParam(searchParams, "window").trim().toLowerCase();
  const timeframeDays: 7 | 30 | null =
    windowRaw === "7" || windowRaw === "7d"
      ? 7
      : windowRaw === "all"
        ? null
        : 30;
  const campaignId = readParam(searchParams, "campaignId").trim();
  const utmSource = readParam(searchParams, "utm_source").trim();

  const summary = await getAdminReferralAttributionOverview({
    client,
    topLimit: 20,
    timeframeDays,
    campaignId: campaignId || null,
    utmSource: utmSource || null,
  });

  const utmSources = Array.from(
    new Set(
      summary.campaigns
        .map((campaign) => String(campaign.utm_source || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Referral attribution analytics</p>
        <p className="text-sm text-slate-200">
          Ops monitoring only. Metrics cover click and capture activity for share-tracking campaigns.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/settings/referrals" className="underline underline-offset-4">
            Back to referral settings
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filters</h2>
        <p className="mt-1 text-xs text-slate-600">
          Filters apply to clicks and captures only (read-only analytics).
        </p>

        <form className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr_1.2fr_auto]" method="get">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Timeframe</span>
            <select
              name="window"
              defaultValue={windowRaw || (timeframeDays === 7 ? "7" : timeframeDays === null ? "all" : "30")}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">UTM source</span>
            <select
              name="utm_source"
              defaultValue={utmSource}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All sources</option>
              {utmSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Campaign</span>
            <select
              name="campaignId"
              defaultValue={campaignId}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All campaigns</option>
              {summary.campaigns.slice(0, 150).map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.channel}
                  {campaign.utm_source ? ` · ${campaign.utm_source}` : ""})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total clicks</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(summary.totals.clicks)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total captures</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(summary.totals.captures)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Captures by channel</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.capturesByChannel.length ? (
            summary.capturesByChannel.map((row) => (
              <div key={row.channel} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{row.channel}</span>
                <span className="ml-2">{formatNumber(row.captures)} captures</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No capture data available yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Top campaigns</h2>
        <p className="mt-1 text-xs text-slate-600">Owner identities are masked for privacy.</p>
        <div className="mt-3 space-y-2">
          {summary.topCampaigns.length ? (
            summary.topCampaigns.map((campaign) => (
              <div
                key={campaign.campaignId}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[1.4fr_0.9fr_0.9fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{campaign.campaignName}</p>
                  <p className="text-xs text-slate-500">{campaign.ownerMask}</p>
                </div>
                <p className="text-sm text-slate-700">
                  Channel: {campaign.channel}
                  {campaign.utm_source ? ` (${campaign.utm_source})` : ""}
                </p>
                <p className="text-sm text-slate-700">{formatNumber(campaign.clicks)} clicks</p>
                <p className="text-sm font-semibold text-slate-900">{formatNumber(campaign.captures)} captures</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No campaign activity yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Anomaly flags (visibility only)</h2>
        <p className="mt-1 text-xs text-slate-600">
          These flags do not block activity. They help ops spot patterns worth investigating.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Same IP hash driving many captures</p>
            <p className="mt-1 text-xs text-slate-600">
              Based on first-touch clicks linked to capture events. IPs are stored as salted hashes.
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {summary.anomalies.ipAttributionClusters.length ? (
                summary.anomalies.ipAttributionClusters.map((row) => (
                  <div key={row.ipHashPrefix} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-slate-600">{row.ipHashPrefix}…</span>
                    <span className="font-semibold text-slate-900">{formatNumber(row.attributions)} captures</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No IP clusters flagged in this window.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Suspicious rapid chain depth</p>
            <p className="mt-1 text-xs text-slate-600">
              Users creating many deep referrals (depth 3+) in a short period.
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {summary.anomalies.deepChains.length ? (
                summary.anomalies.deepChains.map((row) => (
                  <div key={row.referrerMask} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">{row.referrerMask}</span>
                    <span className="font-semibold text-slate-900">
                      {formatNumber(row.deepReferrals)} deep (max {row.maxDepth})
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No deep-chain bursts flagged in this window.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
