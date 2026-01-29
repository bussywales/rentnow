import Link from "next/link";
import { redirect } from "next/navigation";
import { HostAnalyticsPanel } from "@/components/analytics/HostAnalyticsPanel";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { canManageListings } from "@/lib/role-access";
import { normalizeRole } from "@/lib/roles";
import { getLandlordAnalytics, resolveAnalyticsHostId, type AnalyticsRangeKey } from "@/lib/analytics/landlord-analytics";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { fetchUserRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type AnalyticsPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

export default async function DashboardAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured; analytics are unavailable.
        </p>
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const rangeKey =
    typeof resolvedParams.range === "string"
      ? (resolvedParams.range as AnalyticsRangeKey)
      : null;

  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    logAuthRedirect("/dashboard/analytics");
    redirect("/auth/login?reason=auth");
  }

  const role = await fetchUserRole(supabase, user.id);
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "tenant") {
    redirect("/tenant");
  }
  if (normalizedRole === "admin") {
    // Admins should land in the admin console; avoid support-only redirects from dashboard routes.
    redirect("/admin");
  }
  if (!canManageListings(normalizedRole)) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-600">
          Analytics are available to landlords and agents only.
        </p>
        <Link href="/dashboard" className="text-sm font-semibold text-slate-700">
          Back to dashboard
        </Link>
      </div>
    );
  }

  let actingAs: string | null = null;
  let canActAs = false;
  if (normalizedRole === "agent") {
    actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      canActAs = await hasActiveDelegation(supabase, user.id, actingAs);
    }
  }

  const hostScope = resolveAnalyticsHostId({
    userId: user.id,
    role: normalizedRole,
    actingAs,
    canActAs,
  });
  const viewsClient = hasServiceRoleEnv() ? createServiceRoleClient() : undefined;

  const snapshot = await getLandlordAnalytics({
    hostId: hostScope.hostId,
    rangeKey,
    supabase,
    viewsClient,
  });
  const showDiagnostics = process.env.NODE_ENV === "development";

  return (
    <div className="space-y-4">
      {hostScope.actingAsUsed && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Analytics reflect the landlord you are acting on behalf of.
        </div>
      )}
      <HostAnalyticsPanel
        snapshot={snapshot}
        rangeKey={snapshot.range.key}
        baseHref="/dashboard/analytics"
        title="Listing analytics"
        showDiagnostics={showDiagnostics}
      />
    </div>
  );
}
