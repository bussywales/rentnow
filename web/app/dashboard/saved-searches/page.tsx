import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import Link from "next/link";
import { SavedSearchManager } from "@/components/search/SavedSearchManager";
import { PushStatusBadge } from "@/components/dashboard/PushStatusBadge";
import { TenantPushDiagnosticsPanel } from "@/components/dashboard/TenantPushDiagnosticsPanel";
import { getTenantPlanForTier, isPlanExpired } from "@/lib/plans";
import { normalizeRole } from "@/lib/roles";
import { shouldShowSavedSearchNav } from "@/lib/role-access";
import { getPushConfigStatus } from "@/lib/push/config";
import type { SavedSearch } from "@/lib/types";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const normalizedRole = normalizeRole(profile?.role);
  const showSavedSearches = shouldShowSavedSearchNav(normalizedRole);

  if (!showSavedSearches) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Saved searches are available to tenants. Browse homes to find your next place.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/properties" className="font-semibold text-sky-700">
            Browse homes
          </Link>
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
  const { data: planRow } = await supabase
    .from("profile_plans")
    .select("plan_tier, valid_until")
    .eq("profile_id", user.id)
    .maybeSingle();
  const validUntil = planRow?.valid_until ?? null;
  const expired = isPlanExpired(validUntil);
  const tenantPlan = getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
  const alertsEnabled = tenantPlan.instantAlerts;

  const { data: alertRows } = await supabase
    .from("saved_search_alerts")
    .select("sent_at")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(1);
  const lastAlertSentAt = Array.isArray(alertRows) ? alertRows[0]?.sent_at ?? null : null;
  const pushConfig = getPushConfigStatus();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Edit saved searches and check for new home matches.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Alerts & saved searches</p>
        <p className="text-xs text-slate-600">
          {alertsEnabled
            ? "Instant alerts are enabled for your saved searches."
            : "Upgrade to Tenant Pro to get instant alerts for new homes."}
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
        {!alertsEnabled && (
          <Link
            href="/tenant/billing#plans"
            className="mt-3 inline-flex text-sm font-semibold text-sky-700"
          >
            View Tenant Pro
          </Link>
        )}
      </div>
      <TenantPushDiagnosticsPanel />
      <SavedSearchManager initialSearches={searches} alertsEnabled={alertsEnabled} />
    </div>
  );
}
