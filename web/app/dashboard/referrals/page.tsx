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
import { getUserReferralCashoutContext } from "@/lib/referrals/cashout.server";
import { getReferralMilestoneStatusesForUser } from "@/lib/referrals/milestones.server";
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

  const settings = await getReferralSettings(supabase as unknown as SupabaseClient);
  const [snapshot, code, siteUrl, cashoutContext] = await Promise.all([
    getReferralDashboardSnapshot({
      client: supabase as unknown as SupabaseClient,
      userId: user.id,
      maxDepth: settings.maxDepth,
    }),
    resolveReferralCode(supabase as unknown as SupabaseClient, user.id),
    getSiteUrl(),
    getUserReferralCashoutContext({
      userClient: supabase as unknown as SupabaseClient,
      userId: user.id,
      authMetadataCountry:
        ((user.user_metadata as Record<string, unknown> | null)?.country as string | null | undefined) ??
        null,
    }),
  ]);

  const referralLink = code ? `${siteUrl.replace(/\/$/, "")}/r/${encodeURIComponent(code)}` : null;
  const tier = resolveReferralTierStatus(snapshot.verifiedReferrals, settings.tierThresholds);
  const milestones = settings.milestonesEnabled
    ? await getReferralMilestoneStatusesForUser({
        client: supabase as unknown as SupabaseClient,
        userId: user.id,
        activeReferralsCount: snapshot.verifiedReferrals,
      })
    : [];

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
      maxDepth={settings.maxDepth}
      tree={snapshot.tree}
      recentActivity={snapshot.recentActivity}
      wallet={cashoutContext.wallet}
      milestonesEnabled={settings.milestonesEnabled}
      milestones={milestones}
      jurisdictionCountryCode={cashoutContext.jurisdiction.countryCode}
      cashoutPolicy={cashoutContext.policy}
      cashoutRequests={cashoutContext.requests}
    />
  );
}
