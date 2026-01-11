import { redirect } from "next/navigation";
import { buildDataQualitySnapshot, type DataQualitySnapshot } from "@/lib/admin/data-quality";
import { buildBetaReadinessSnapshot } from "@/lib/admin/beta-readiness";
import { buildMarketplaceAnalytics, type MarketplaceAnalyticsSnapshot } from "@/lib/admin/marketplace-analytics";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPushConfig } from "@/lib/push/server";

export const dynamic = "force-dynamic";

type AnalyticsDiagnostics = {
  supabaseReady: boolean;
  serviceRoleReady: boolean;
  analytics: MarketplaceAnalyticsSnapshot | null;
  dataQuality: DataQualitySnapshot | null;
  betaReadiness: ReturnType<typeof buildBetaReadinessSnapshot> | null;
  error: string | null;
};

async function getAnalyticsDiagnostics(): Promise<AnalyticsDiagnostics> {
  if (!hasServerSupabaseEnv()) {
    return {
      supabaseReady: false,
      serviceRoleReady: false,
      analytics: null,
      dataQuality: null,
      betaReadiness: null,
      error: "Supabase env vars missing.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/analytics&reason=auth");
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
  const pushConfig = getPushConfig();
  if (!serviceRoleReady) {
    const betaReadiness = buildBetaReadinessSnapshot({
      supabaseReady: true,
      serviceRoleReady: false,
      pushConfigured: pushConfig.configured,
      missingPhotosAvailable: false,
    });
    return {
      supabaseReady: true,
      serviceRoleReady,
      analytics: null,
      dataQuality: null,
      betaReadiness,
      error: "Service role key missing; analytics unavailable.",
    };
  }

  const adminClient = createServiceRoleClient();
  const { snapshot, error: dataQualityError } = await buildDataQualitySnapshot(adminClient);
  const analytics = await buildMarketplaceAnalytics(adminClient, snapshot);
  const betaReadiness = buildBetaReadinessSnapshot({
    supabaseReady: true,
    serviceRoleReady,
    pushConfigured: pushConfig.configured,
    missingPhotosAvailable: snapshot.counts.missingPhotos !== null,
  });

  return {
    supabaseReady: true,
    serviceRoleReady,
    analytics,
    dataQuality: snapshot,
    betaReadiness,
    error: analytics.errors.length ? analytics.errors.join(" | ") : dataQualityError,
  };
}

function formatDelta(delta: number | null) {
  if (delta === null) return "Not available";
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function formatDirection(direction: MarketplaceAnalyticsSnapshot["trends"]["listingsCreated"]["direction"]) {
  switch (direction) {
    case "up":
      return "▲";
    case "down":
      return "▼";
    case "flat":
      return "■";
    default:
      return "•";
  }
}

function renderMetric(value: number | null, suffix?: string) {
  if (value === null) return "Not available";
  return suffix ? `${value}${suffix}` : String(value);
}

export default async function AdminAnalyticsPage() {
  const diag = await getAnalyticsDiagnostics();
  const showDiagnostics = process.env.NODE_ENV === "development";
  const overview = diag.analytics?.overview ?? null;
  const trends = diag.analytics?.trends ?? null;
  const totalListings = overview?.total ?? null;
  const showEmpty = totalListings === 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Marketplace analytics</h1>
        <p className="text-sm text-slate-600">Read-only marketplace health snapshot for beta operators.</p>
      </div>

      {!diag.supabaseReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase is not configured; analytics are unavailable.
        </div>
      )}

      {diag.supabaseReady && !diag.serviceRoleReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Service role key missing; analytics are unavailable until it is configured.
        </div>
      )}

      {diag.supabaseReady && diag.serviceRoleReady && (
        <>
          {showEmpty && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              No activity yet. Listings will appear here once hosts publish properties.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total listings</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {renderMetric(overview?.total ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Live</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {renderMetric(overview?.live ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {renderMetric(overview?.pending ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Draft</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {renderMetric(overview?.draft ?? null)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Listing coverage</h2>
              <p className="text-sm text-slate-600">Percent of listings with key fields.</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Photos: {renderMetric(overview?.withPhotosPct ?? null, "%")}</li>
                <li>Description: {renderMetric(overview?.withDescriptionPct ?? null, "%")}</li>
                <li>Trust badges: {renderMetric(overview?.withTrustPct ?? null, "%")}</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Engagement</h2>
              <p className="text-sm text-slate-600">Derived ratios are shown when tracked.</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  Listing views (last 7d): {renderMetric(overview?.viewsLast7 ?? null)}
                  {" · "}
                  {formatDirection(trends?.listingViews.direction ?? "not_available")}{" "}
                  {formatDelta(trends?.listingViews.delta ?? null)}
                </li>
                <li>
                  Unique authenticated viewers (last 7d):{" "}
                  {renderMetric(overview?.uniqueAuthViewersLast7 ?? null)}
                </li>
                <li>
                  Anonymous views (last 7d): {renderMetric(overview?.anonymousViewsLast7 ?? null)}
                </li>
                <li>Searches → results: {overview?.searchesToResults ?? "Not available"}</li>
                <li>Views → enquiries: {overview?.viewsToEnquiries ?? "Not available"}</li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Anonymous views are recorded without per-viewer dedupe.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Trends</h2>
              <p className="text-sm text-slate-600">Last 7 days vs previous 7 days.</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>New listings</span>
                  <span className="font-semibold">
                    {formatDirection(trends?.listingsCreated.direction ?? "not_available")}{" "}
                    {formatDelta(trends?.listingsCreated.delta ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Live approvals</span>
                  <span className="font-semibold">
                    {formatDirection(trends?.liveListings.direction ?? "not_available")}{" "}
                    {formatDelta(trends?.liveListings.delta ?? null)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">System health</h2>
              <p className="text-sm text-slate-600">High-level checks from admin diagnostics.</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  Data quality:{" "}
                  {diag.dataQuality
                    ? `Missing photos ${diag.dataQuality.counts.missingPhotos ?? "n/a"} · Missing country code ${diag.dataQuality.counts.missingCountryCode}`
                    : "Not available"}
                </li>
                <li>
                  Beta readiness:{" "}
                  {diag.betaReadiness
                    ? diag.betaReadiness.blockers.length
                      ? "Blocks present"
                      : "No blockers detected"
                    : "Not available"}
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {showDiagnostics && diag.error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Diagnostics: {diag.error}
        </div>
      )}
    </div>
  );
}
