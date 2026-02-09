import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import AgentReferralDashboard from "@/components/referrals/AgentReferralDashboard";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { normalizeRole } from "@/lib/roles";
import { fetchUserRole } from "@/lib/auth/role";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { getReferralDashboardSnapshot, ensureReferralCode } from "@/lib/referrals/referrals.server";
import { getReferralSettings, resolveReferralTierStatus } from "@/lib/referrals/settings";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

async function resolveReferralCode(userClient: SupabaseClient, userId: string) {
  if (hasServiceRoleEnv()) {
    const serviceClient = createServiceRoleClient() as unknown as SupabaseClient;
    const ensured = await ensureReferralCode({ client: serviceClient, userId });
    if (ensured.code) return ensured.code;
  }

  const { data } = await userClient
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle<{ code: string | null }>();

  return data?.code ?? null;
}

export default async function DashboardReferralsPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    logAuthRedirect("/dashboard/referrals");
    redirect("/auth/login?reason=auth");
  }

  const role = normalizeRole(await fetchUserRole(supabase, user.id));
  if (role === "tenant") {
    redirect("/tenant/home");
  }
  if (role === "admin") {
    redirect("/admin");
  }

  if (role !== "agent") {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
        <p className="text-sm text-slate-600">
          Referral rewards are available to agent workspaces only.
        </p>
        <Link href="/dashboard" className="text-sm font-semibold text-slate-800 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const [snapshot, code, settings, siteUrl] = await Promise.all([
    getReferralDashboardSnapshot({ client: supabase as unknown as SupabaseClient, userId: user.id }),
    resolveReferralCode(supabase as unknown as SupabaseClient, user.id),
    getReferralSettings(supabase as unknown as SupabaseClient),
    getSiteUrl(),
  ]);

  const referralLink = code ? `${siteUrl.replace(/\/$/, "")}/r/${encodeURIComponent(code)}` : null;
  const tier = resolveReferralTierStatus(snapshot.verifiedReferrals, settings.tierThresholds);

  return (
    <AgentReferralDashboard
      referralCode={code}
      referralLink={referralLink}
      totalReferrals={snapshot.totalReferrals}
      directReferrals={snapshot.directReferrals}
      indirectReferrals={snapshot.indirectReferrals}
      verifiedReferrals={snapshot.verifiedReferrals}
      creditsEarnedTotal={snapshot.creditsEarnedTotal}
      creditsIssuedTotal={snapshot.creditsIssuedTotal}
      creditsUsedTotal={snapshot.creditsUsedTotal}
      creditsEarnedByLevel={snapshot.creditsEarnedByLevel}
      tier={tier}
      tree={snapshot.tree}
      recentActivity={snapshot.recentActivity}
    />
  );
}
