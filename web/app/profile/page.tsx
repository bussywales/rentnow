import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { shouldShowClientPagesShortcut } from "@/lib/profile/client-pages-shortcut";
import { getReferralSettings, resolveReferralTierStatus } from "@/lib/referrals/settings";
import { getReferralDashboardSnapshot } from "@/lib/referrals/referrals.server";
import ReferralTierBadge from "@/components/referrals/ReferralTierBadge";
import ProfileFormClient from "@/components/profile/ProfileFormClient";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/profile&reason=auth");
  }

  const session = await getSession();
  if (!session?.user) {
    redirect("/auth/login?reason=auth&redirect=/profile");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, full_name, phone, avatar_url, public_slug, agent_storefront_enabled, agent_slug, agent_bio"
    )
    .eq("id", session.user.id)
    .maybeSingle();

  const email = session.user.email ?? "";
  const showClientPages = shouldShowClientPagesShortcut(profile?.role ?? null);
  let referralTierSummary: {
    currentTier: string;
    activeReferrals: number;
    nextTier: string | null;
    remainingToNext: number;
  } | null = null;

  if (profile?.role === "agent") {
    try {
      const settings = await getReferralSettings(supabase as unknown as SupabaseClient);
      const snapshot = await getReferralDashboardSnapshot({
        client: supabase as unknown as SupabaseClient,
        userId: session.user.id,
        maxDepth: settings.maxDepth,
      });
      const tier = resolveReferralTierStatus(snapshot.verifiedReferrals, settings.tierThresholds);
      referralTierSummary = {
        currentTier: tier.currentTier,
        activeReferrals: snapshot.verifiedReferrals,
        nextTier: tier.nextTier,
        remainingToNext:
          tier.nextThreshold !== null
            ? Math.max(0, tier.nextThreshold - snapshot.verifiedReferrals)
            : 0,
      };
    } catch {
      referralTierSummary = null;
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update your details and keep your account secure.
        </p>
      </header>
      {referralTierSummary && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Referral tier</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {referralTierSummary.activeReferrals} Active referrals
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {referralTierSummary.nextTier
                  ? `${referralTierSummary.remainingToNext} more Active referrals to reach ${referralTierSummary.nextTier}.`
                  : "You are currently at the highest referral tier."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <ReferralTierBadge tier={referralTierSummary.currentTier} />
              <Link
                href="/dashboard/referrals"
                className="text-sm font-semibold text-slate-900 underline underline-offset-4"
              >
                Open referrals dashboard
              </Link>
            </div>
          </div>
        </section>
      )}
      {showClientPages && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client pages</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Client pages</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create shortlists you can share with clients.
              </p>
            </div>
            <Link href="/profile/clients" className="shrink-0">
              <Button data-testid="client-pages-shortcut">Manage client pages</Button>
            </Link>
          </div>
        </section>
      )}
      <ProfileFormClient userId={session.user.id} email={email} initialProfile={profile} />
    </div>
  );
}
