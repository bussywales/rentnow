import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { parseExploreAnalyticsSettingsRows } from "@/lib/explore/explore-analytics-settings";
import {
  buildExploreAnalyticsCounters,
  fetchExploreAnalyticsRows,
  resolveExploreAnalyticsRange,
} from "@/lib/explore/explore-analytics.server";
import { ExploreAnalyticsDashboard } from "@/components/admin/ExploreAnalyticsDashboard";
import { ExploreAnalyticsExports } from "@/components/admin/ExploreAnalyticsExports";
import { ExploreAnalyticsToggles } from "@/components/admin/ExploreAnalyticsToggles";
import { AdminAnalyticsSectionNav } from "@/components/admin/AdminAnalyticsSectionNav";

export const dynamic = "force-dynamic";

type AdminExploreAnalyticsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type AppSettingRow = {
  key: string;
  value: unknown;
  updated_at: string | null;
};

function pickSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminExploreAnalyticsPage({
  searchParams,
}: AdminExploreAnalyticsPageProps) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/analytics/explore&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const range = resolveExploreAnalyticsRange({
    date: pickSearchParam(searchParams, "date"),
    start: pickSearchParam(searchParams, "start"),
    end: pickSearchParam(searchParams, "end"),
  });

  const dataClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const [rows, settingsRowsRaw] = await Promise.all([
    fetchExploreAnalyticsRows({
      client: dataClient,
      startIso: range.startIso,
      endIso: range.endIso,
      limit: 50000,
    }),
    dataClient
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", [
        APP_SETTING_KEYS.exploreAnalyticsEnabled,
        APP_SETTING_KEYS.exploreAnalyticsConsentRequired,
        APP_SETTING_KEYS.exploreAnalyticsNoticeEnabled,
      ]),
  ]);

  const settingsRows = ((settingsRowsRaw.data as AppSettingRow[] | null) ?? []).filter(Boolean);
  const settings = parseExploreAnalyticsSettingsRows(settingsRows);
  const settingsUpdatedAt =
    settingsRows
      .map((row) => row.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const counters = buildExploreAnalyticsCounters(rows);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6" data-testid="admin-explore-analytics-page">
      <section className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <h1 className="text-2xl font-semibold">Explore analytics</h1>
        <p className="mt-1 text-sm text-slate-200">
          Non-PII funnel telemetry for Explore. Exports include event timestamp, session, listing, market, and intent only.
        </p>
      </section>

      <AdminAnalyticsSectionNav current="explore" />

      <ExploreAnalyticsDashboard counters={counters} totalEvents={rows.length} rangeLabel={range.label} />

      <ExploreAnalyticsExports initialStartDate={range.startDate} initialEndDate={range.endDate} />

      <ExploreAnalyticsToggles
        enabled={settings.enabled}
        consentRequired={settings.consentRequired}
        noticeEnabled={settings.noticeEnabled}
        updatedAt={settingsUpdatedAt}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <p>
          Quick links:
          {" "}
          <a
            className="font-semibold text-sky-700 hover:text-sky-800"
            href={`/api/admin/analytics/explore/export?date=${today}`}
          >
            Export today
          </a>
          {" · "}
          <a
            className="font-semibold text-sky-700 hover:text-sky-800"
            href={`/api/admin/analytics/explore/export?start=${range.startDate}&end=${range.endDate}`}
          >
            Export current range
          </a>
          {" · "}
          <a
            className="font-semibold text-sky-700 hover:text-sky-800"
            href={`/admin/analytics/explore-v2?start=${range.startDate}&end=${range.endDate}`}
          >
            Explore V2 conversion report
          </a>
        </p>
      </section>
    </div>
  );
}
