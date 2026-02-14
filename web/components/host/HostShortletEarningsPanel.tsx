"use client";

import type { HostShortletEarningSummary } from "@/lib/shortlet/shortlet.server";

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

export function HostShortletEarningsPanel(props: { rows: HostShortletEarningSummary[] }) {
  const totalPaid = props.rows
    .filter((row) => row.payout_status === "paid")
    .reduce((sum, row) => sum + row.amount_minor, 0);
  const totalPending = props.rows
    .filter((row) => row.payout_status === "eligible")
    .reduce((sum, row) => sum + row.amount_minor, 0);
  const currency = props.rows[0]?.currency || "NGN";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlet earnings</p>
          <h3 className="text-lg font-semibold text-slate-900">Payout status</h3>
        </div>
        <div className="text-right text-xs text-slate-600">
          <div>Paid: {formatMoney(currency, totalPaid)}</div>
          <div>Pending payout: {formatMoney(currency, totalPending)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Listing</th>
              <th className="px-3 py-2">Stay</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.rows.length ? (
              props.rows.map((row) => (
                <tr key={row.payout_id}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</div>
                    <div className="text-xs text-slate-500">{row.property_city || "Unknown city"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <div>{row.check_in || "—"} → {row.check_out || "—"}</div>
                    <div className="text-slate-500">Booking: {row.booking_status || "—"}</div>
                  </td>
                  <td className="px-3 py-2">{formatMoney(row.currency, row.amount_minor)}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="inline-flex rounded-full border border-slate-200 px-2 py-1 text-slate-700">
                      {row.payout_status}
                    </span>
                    {row.paid_at ? <div className="mt-1 text-slate-500">{new Date(row.paid_at).toLocaleString()}</div> : null}
                    {row.paid_reference ? <div className="text-slate-500">Ref: {row.paid_reference}</div> : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-slate-500">
                  No shortlet payout records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
