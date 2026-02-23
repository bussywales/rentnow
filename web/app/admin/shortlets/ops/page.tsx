import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { AdminShortletsOpsDashboard } from "@/components/admin/AdminShortletsOpsDashboard";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/shortlets/ops&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/forbidden?reason=role");
}

export default async function AdminShortletsOpsPage() {
  await requireAdmin();

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4"
      data-testid="admin-shortlets-ops"
    >
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Shortlets Ops</p>
        <p className="text-sm text-slate-200">Live readiness checks for reminders, payouts, SLA risk, and mismatches.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/shortlets" className="underline underline-offset-4">
            Back to shortlet bookings
          </Link>
          <Link href="/admin/shortlets/payouts" className="underline underline-offset-4">
            Manual payouts queue
          </Link>
        </div>
      </div>

      <AdminShortletsOpsDashboard />
    </div>
  );
}
