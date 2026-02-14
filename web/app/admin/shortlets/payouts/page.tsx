import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { listAdminShortletPayouts } from "@/lib/shortlet/shortlet.server";
import { AdminShortletPayoutsTable } from "@/components/admin/AdminShortletPayoutsTable";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/shortlets/payouts&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  return hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : (supabase as unknown as UntypedAdminClient);
}

export default async function AdminShortletPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = firstValue(params.status) || "eligible";
  const client = await requireAdmin();
  const rows = await listAdminShortletPayouts({
    client: client as unknown as SupabaseClient,
    status: status === "paid" ? "paid" : status === "all" ? "all" : "eligible",
    limit: 300,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Shortlet payouts (manual)</p>
        <p className="text-sm text-slate-200">
          Manual payout queue for pilot hosts. Only pay eligible bookings after check-in.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/shortlets" className="underline underline-offset-4">
            Back to bookings
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</span>
            <select name="status" defaultValue={status} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="eligible">Eligible</option>
              <option value="paid">Paid</option>
              <option value="all">All</option>
            </select>
          </label>
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white">
            Apply
          </button>
          <Link
            href={`/api/admin/shortlets/payouts/export.csv?status=${encodeURIComponent(status || "eligible")}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
          >
            Export CSV
          </Link>
        </div>
      </form>

      <AdminShortletPayoutsTable initialRows={rows} />
    </div>
  );
}
