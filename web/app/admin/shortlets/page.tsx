import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { listAdminShortletBookings } from "@/lib/shortlet/shortlet.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(currency: string, amountMinor: number): string {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/shortlets&reason=auth");

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

export default async function AdminShortletsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = firstValue(params.status) || "all";
  const from = firstValue(params.from) || "";
  const to = firstValue(params.to) || "";
  const q = firstValue(params.q) || "";

  const client = await requireAdmin();
  const rows = await listAdminShortletBookings({
    client: client as unknown as SupabaseClient,
    status,
    from,
    to,
    q,
    limit: 250,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Shortlet bookings</p>
        <p className="text-sm text-slate-200">
          Monitor requests, confirmations, expiries, and refund-needed shortlet records.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/shortlets/payouts" className="underline underline-offset-4">
            Manual payouts queue
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</span>
            <select name="status" defaultValue={status} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">From</span>
            <input type="date" name="from" defaultValue={from} className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">To</span>
            <input type="date" name="to" defaultValue={to} className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Search</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Booking ID / listing / user ID"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white">
              Apply
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      {row.status}
                    </span>
                    {row.refund_required ? (
                      <div className="mt-1 text-[11px] font-semibold text-amber-700">Refund-needed</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.property_title || row.property_id}</div>
                    <div className="text-xs text-slate-500">{row.city || "Unknown city"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    <div>
                      {row.check_in} to {row.check_out}
                    </div>
                    <div>{row.nights} nights</div>
                    {row.expires_at ? <div className="text-amber-700">Expires {new Date(row.expires_at).toLocaleString()}</div> : null}
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.currency, row.total_amount_minor)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.guest_user_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.host_user_id}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-500">
                  No shortlet bookings for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
