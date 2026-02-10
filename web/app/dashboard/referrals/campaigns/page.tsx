import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { fetchUserRole } from "@/lib/auth/role";
import { normalizeRole } from "@/lib/roles";
import { getReferralOwnerAnalytics } from "@/lib/referrals/share-tracking.server";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

export default async function ReferralCampaignsPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/login?reason=auth");

  const role = normalizeRole(await fetchUserRole(supabase, user.id));
  if (role === "tenant") redirect("/tenant/home");
  if (role === "admin") redirect("/admin");
  if (role !== "agent" && role !== "landlord") redirect("/forbidden?reason=role");

  const analytics = await getReferralOwnerAnalytics({
    client: supabase as unknown as SupabaseClient,
    ownerId: user.id,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Referral campaigns</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track performance of each shared link by clicks, captures, active referrals, and earned credits.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
            Back to referrals dashboard
          </Link>
          <Link href="/dashboard/referrals/invites" className="font-semibold text-slate-900 underline underline-offset-4">
            Invite reminders
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Clicks</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(analytics.totals.clicks)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Captures</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(analytics.totals.captures)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(analytics.totals.activeReferrals)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Credits earned</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{analytics.totals.earningsCredits.toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Campaign list</h2>
        <p className="mt-1 text-xs text-slate-600">Sorted by captures and clicks.</p>
        <div className="mt-3 space-y-2">
          {analytics.campaigns.length ? (
            analytics.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                  <p className="text-xs text-slate-500">{campaign.channel.toUpperCase()} · {campaign.is_active ? "Active" : "Disabled"}</p>
                </div>
                <p className="text-sm text-slate-700">{formatNumber(campaign.clicks)} clicks</p>
                <p className="text-sm text-slate-700">{formatNumber(campaign.captures)} captures</p>
                <p className="text-sm text-slate-700">{formatNumber(campaign.activeReferrals)} active</p>
                <p className="text-sm text-slate-700">{campaign.earningsCredits.toFixed(2)} credits</p>
                <Link
                  href={`/dashboard/referrals/campaigns/${encodeURIComponent(campaign.id)}`}
                  className="text-sm font-semibold text-slate-800 underline underline-offset-4"
                >
                  Open
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No campaigns yet. Create one from the referrals dashboard.</p>
          )}
        </div>
      </section>
    </div>
  );
}
