import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import Link from "next/link";
import { SavedSearchManager } from "@/components/search/SavedSearchManager";
import { PushStatusBadge } from "@/components/dashboard/PushStatusBadge";
import { TenantPushDiagnosticsPanel } from "@/components/dashboard/TenantPushDiagnosticsPanel";
import { shouldShowSavedSearchNav } from "@/lib/role-access";
import { getPushConfigStatus } from "@/lib/push/config";
import type { SavedSearch } from "@/lib/types";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ alerts?: string }>;
}) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured; saved searches are unavailable.
        </p>
      </div>
    );
  }

  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    logAuthRedirect("/dashboard/saved-searches");
    redirect("/auth/login?reason=auth");
  }

  const showSavedSearches = shouldShowSavedSearchNav();

  if (!showSavedSearches) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Complete your profile to start saving searches for quick access later.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/dashboard" className="font-semibold text-slate-600">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const searches = (data as SavedSearch[]) || [];
  const alertsEnabled = true;

  const { data: alertRows } = await supabase
    .from("saved_search_alerts")
    .select("sent_at")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(1);
  const lastAlertSentAt = Array.isArray(alertRows) ? alertRows[0]?.sent_at ?? null : null;
  const pushConfig = getPushConfigStatus();
  const params = (await searchParams) ?? {};
  const alertStatus = params.alerts ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Edit saved searches and check for new home matches.
        </p>
        {alertStatus === "ok" && (
          <p className="mt-2 text-sm font-medium text-emerald-700">
            Alert emails disabled for that search.
          </p>
        )}
        {alertStatus === "invalid" && (
          <p className="mt-2 text-sm font-medium text-rose-700">
            That unsubscribe link is invalid or expired.
          </p>
        )}
        {alertStatus === "error" && (
          <p className="mt-2 text-sm font-medium text-rose-700">
            We could not update alert settings. Please try again.
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Alerts & saved searches</p>
        <p className="text-xs text-slate-600">
          Set per-search email alerts with instant, daily, or weekly frequency.
        </p>
        {!pushConfig.configured ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <p className="font-semibold">Notifications currently unavailable</p>
            <p className="mt-1 text-amber-800">
              Push notifications are not configured yet. Saved searches still work and
              email alerts may deliver when available.
            </p>
          </div>
        ) : (
          <PushStatusBadge />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>Active alerts: {searches.length}</span>
          <span>
            Last alert sent: {lastAlertSentAt ? new Date(lastAlertSentAt).toLocaleString() : "—"}
          </span>
        </div>
      </div>
      <TenantPushDiagnosticsPanel />
      <SavedSearchManager initialSearches={searches} alertsEnabled={alertsEnabled} />
    </div>
  );
}
