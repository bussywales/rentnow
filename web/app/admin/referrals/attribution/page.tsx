import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import { getAdminReferralAttributionOverview } from "@/lib/referrals/share-tracking.server";

export const dynamic = "force-dynamic";

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

export default async function AdminReferralAttributionPage() {
  const { client } = await requireAdmin();
  const summary = await getAdminReferralAttributionOverview({ client, topLimit: 20 });

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
                <p className="text-sm text-slate-700">Channel: {campaign.channel}</p>
                <p className="text-sm text-slate-700">{formatNumber(campaign.clicks)} clicks</p>
                <p className="text-sm font-semibold text-slate-900">{formatNumber(campaign.captures)} captures</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No campaign activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
