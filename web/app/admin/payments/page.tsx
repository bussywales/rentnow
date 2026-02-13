import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { fetchAdminPayments } from "@/lib/payments/featured-payments.server";
import { fetchPaymentWebhookEvents } from "@/lib/payments/featured-payments-ops.server";
import { fetchPaymentsOpsSnapshot } from "@/lib/payments/reconcile.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import AdminPaymentsReconcilePanel from "@/components/admin/AdminPaymentsReconcilePanel";
import AdminPaymentsOpsPanel from "@/components/admin/AdminPaymentsOpsPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toAnchorSafe(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/payments&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  return {
    client: hasServiceRoleEnv()
      ? (createServiceRoleClient() as unknown as UntypedAdminClient)
      : (supabase as unknown as UntypedAdminClient),
  };
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = firstValue(params.status) || "all";
  const from = firstValue(params.from) || "";
  const to = firstValue(params.to) || "";

  const { client } = await requireAdmin();
  const [rows, webhookEvents, opsSnapshot] = await Promise.all([
    fetchAdminPayments({
      client,
      filters: { status, from, to, limit: 200 },
    }),
    fetchPaymentWebhookEvents({
      client,
      limit: 50,
    }),
    fetchPaymentsOpsSnapshot({
      client,
      stuckLimit: 10,
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Payments</p>
        <p className="text-sm text-slate-200">
          Featured activation payments (Paystack). Use this for reconciliation.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/settings/billing" className="underline underline-offset-4">
            Billing settings
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</span>
            <select name="status" defaultValue={status} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="all">All</option>
              <option value="initialized">Initialized</option>
              <option value="pending">Pending</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      <AdminPaymentsOpsPanel
        stuckCount={opsSnapshot.stuckCount}
        receiptsPendingCount={opsSnapshot.receiptsPendingCount}
        stuckRows={opsSnapshot.stuckRows}
      />

      <AdminPaymentsReconcilePanel />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((row) => {
                const purchase = Array.isArray((row as { featured_purchases?: unknown[] }).featured_purchases)
                  ? ((row as { featured_purchases?: Array<Record<string, unknown>> }).featured_purchases?.[0] ??
                    null)
                  : null;
                const property = purchase && typeof purchase === "object"
                  ? ((purchase as { properties?: Record<string, unknown> | null }).properties ?? null)
                  : null;

                const reference = String((row as { reference?: string }).reference || "");
                const rowAnchor = `payment-ref-${toAnchorSafe(reference || "unknown")}`;

                return (
                  <tr key={String((row as { id?: string }).id || "")} id={rowAnchor}>
                    <td className="px-4 py-3">{String((row as { status?: string }).status || "—")}</td>
                    <td className="px-4 py-3">
                      {String((row as { currency?: string }).currency || "NGN")}{" "}
                      {Number((row as { amount_minor?: number }).amount_minor || 0) / 100}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{reference || "—"}</td>
                    <td className="px-4 py-3">
                      {property ? (
                        <Link
                          href={`/properties/${String((purchase as { property_id?: string }).property_id || "")}`}
                          className="text-sky-700 underline underline-offset-2"
                        >
                          {String((property as { title?: string }).title || "View listing")}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{String((row as { user_id?: string }).user_id || "—")}</td>
                    <td className="px-4 py-3">
                      {String((row as { created_at?: string }).created_at || "").slice(0, 19).replace("T", " ")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                  No payment records found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Webhook events (latest 50)</h2>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Processed</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {webhookEvents.length ? (
              webhookEvents.map((row) => (
                <tr key={String((row as { id?: string }).id || "")}>
                  <td className="px-4 py-3">
                    {String((row as { received_at?: string }).received_at || "")
                      .slice(0, 19)
                      .replace("T", " ")}
                  </td>
                  <td className="px-4 py-3">{String((row as { event?: string }).event || "—")}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {String((row as { reference?: string }).reference || "").trim() ? (
                      <a
                        className="text-sky-700 underline underline-offset-2"
                        href={`#payment-ref-${toAnchorSafe(
                          String((row as { reference?: string }).reference || "")
                        )}`}
                      >
                        {String((row as { reference?: string }).reference || "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(row as { processed?: boolean }).processed ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {String((row as { process_error?: string }).process_error || "—")}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500" colSpan={5}>
                  No webhook events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
