"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AdminShortletPayoutSummary } from "@/lib/shortlet/shortlet.server";

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

export function AdminShortletPayoutsTable(props: { initialRows: AdminShortletPayoutSummary[] }) {
  const [rows, setRows] = useState<AdminShortletPayoutSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibleCount = useMemo(() => rows.filter((row) => row.status === "eligible").length, [rows]);

  async function markPaid(row: AdminShortletPayoutSummary) {
    if (busyId) return;
    const paidRef = window.prompt("Payment reference (optional)", row.paid_ref || "") ?? "";
    const note = window.prompt("Admin note (optional)", row.note || "") ?? "";
    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/shortlets/payouts/${row.id}/pay`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid_ref: paidRef.trim() || null,
          note: note.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; payout?: { paid_at?: string; paid_ref?: string | null } }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to mark payout paid");
      }
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: "paid",
                paid_at: payload?.payout?.paid_at ?? new Date().toISOString(),
                paid_ref: payload?.payout?.paid_ref ?? (paidRef.trim() || null),
                note: note.trim() || item.note,
              }
            : item
        )
      );
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Unable to mark payout paid");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Eligible payouts: <span className="font-semibold text-slate-900">{eligibleCount}</span>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Action</th>
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
                    {row.paid_at ? (
                      <div className="mt-1 text-[11px] text-slate-500">{new Date(row.paid_at).toLocaleString()}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.property_title || row.property_id || "Listing"}</div>
                    <div className="text-xs text-slate-500">{row.property_city || "Unknown city"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    <div className="font-mono">{row.booking_id}</div>
                    <div>Check-in: {row.booking_check_in || "—"}</div>
                    <div>Booking status: {row.booking_status || "—"}</div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.currency, row.amount_minor)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.host_user_id}</td>
                  <td className="px-4 py-3">
                    {row.status === "eligible" ? (
                      <Button size="sm" onClick={() => markPaid(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? "Processing..." : "Mark paid"}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">{row.paid_ref ? `Ref: ${row.paid_ref}` : "Paid"}</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  No payouts found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

