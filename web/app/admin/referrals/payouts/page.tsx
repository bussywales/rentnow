import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import AdminReferralPayoutQueue from "@/components/admin/AdminReferralPayoutQueue";
import { fetchAdminCashoutQueue } from "@/lib/referrals/cashout-admin.server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/referrals/payouts&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return {
    user,
    client: hasServiceRoleEnv()
      ? (createServiceRoleClient() as unknown as SupabaseClient)
      : (supabase as unknown as SupabaseClient),
  };
}

export default async function AdminReferralPayoutsPage() {
  const { client } = await requireAdmin();

  const queueItems = await fetchAdminCashoutQueue({
    client,
    filters: {
      status: "all",
      risk: "any",
      timeframe: "30d",
      limit: 200,
    },
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Referral payouts queue</p>
        <p className="text-sm text-slate-200">
          Manual processing only. Record payout references after external transfer.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/settings/referrals" className="underline underline-offset-4">
            Back to referral settings
          </Link>
          <Link href="/help/referrals" className="underline underline-offset-4">
            Referral FAQ
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <AdminReferralPayoutQueue initialRequests={queueItems} />
    </div>
  );
}
