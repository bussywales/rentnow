import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import AdminReferralPayoutQueue from "@/components/admin/AdminReferralPayoutQueue";

export const dynamic = "force-dynamic";

type CashoutRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

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

  const { data: rows } = await client
    .from("referral_cashout_requests")
    .select(
      "id, user_id, country_code, credits_requested, cash_amount, currency, rate_used, status, admin_note, payout_reference, requested_at, decided_at, paid_at"
    )
    .order("requested_at", { ascending: false })
    .limit(200);

  const requests = (rows as CashoutRow[] | null) ?? [];
  const userIds = Array.from(new Set(requests.map((row) => row.user_id).filter(Boolean)));

  const { data: profileRows } = userIds.length
    ? await client.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as ProfileRow[] };

  const profileMap = new Map(
    ((profileRows as ProfileRow[] | null) ?? []).map((profile) => [profile.id, profile])
  );

  const queueItems = requests.map((request) => {
    const profile = profileMap.get(request.user_id);
    return {
      ...request,
      user: {
        id: request.user_id,
        full_name: profile?.full_name ?? null,
        email: null,
      },
    };
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
