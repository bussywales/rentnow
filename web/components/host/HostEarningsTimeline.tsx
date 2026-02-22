"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HostEarningsTimeline, HostEarningsTimelineItem } from "@/lib/shortlet/host-earnings";

type EarningsTab = "available" | "upcoming" | "paid" | "all";

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

function formatStayLabel(item: Pick<HostEarningsTimelineItem, "checkIn" | "checkOut" | "nights">) {
  return `${item.checkIn} → ${item.checkOut} (${item.nights} night${item.nights === 1 ? "" : "s"})`;
}

function statusTone(status: string) {
  if (status === "pending" || status === "pending_payment") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "confirmed" || status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function payoutTone(status: HostEarningsTimelineItem["payoutStatus"]) {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function toDateValue(dateIso: string) {
  const value = Date.parse(dateIso);
  if (!Number.isFinite(value)) return null;
  return value;
}

function isUpcomingTimelineItem(item: HostEarningsTimelineItem, todayMs: number) {
  const checkInMs = toDateValue(item.checkIn);
  if (checkInMs === null) return false;
  if (item.bookingStatus === "pending") return true;
  if (item.bookingStatus === "pending_payment") return true;
  return item.payoutStatus !== "paid" && checkInMs >= todayMs;
}

function resolveRowsForTab(input: {
  tab: EarningsTab;
  rows: HostEarningsTimelineItem[];
  todayMs: number;
}) {
  if (input.tab === "all") return input.rows;
  if (input.tab === "available") {
    return input.rows.filter((row) => row.payoutStatus === "pending");
  }
  if (input.tab === "paid") {
    return input.rows.filter((row) => row.payoutStatus === "paid");
  }
  return input.rows.filter((row) => isUpcomingTimelineItem(row, input.todayMs));
}

export function HostEarningsTimelineView(props: { timeline: HostEarningsTimeline }) {
  const [tab, setTab] = useState<EarningsTab>("available");
  const [detailsItem, setDetailsItem] = useState<HostEarningsTimelineItem | null>(null);
  const [requestPayoutItem, setRequestPayoutItem] = useState<HostEarningsTimelineItem | null>(null);
  const rows = props.timeline.items;
  const currency = rows[0]?.currency || "NGN";
  const todayMs = useMemo(() => {
    const today = new Date();
    return Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }, []);
  const visibleRows = useMemo(
    () => resolveRowsForTab({ tab, rows, todayMs }),
    [rows, tab, todayMs]
  );

  return (
    <section className="space-y-4" data-testid="host-earnings-timeline">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Available to payout</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(currency, props.timeline.summary.availableToPayoutMinor)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Paid out</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(currency, props.timeline.summary.paidOutMinor)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Gross earnings</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(currency, props.timeline.summary.grossEarningsMinor)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Awaiting approval</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{props.timeline.summary.pendingApprovalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Upcoming stays</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{props.timeline.summary.upcomingCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Earnings tabs">
        {([
          { id: "available" as const, label: "Available" },
          { id: "upcoming" as const, label: "Upcoming" },
          { id: "paid" as const, label: "Paid" },
          { id: "all" as const, label: "All" },
        ]).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === entry.id
                ? "bg-sky-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {visibleRows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Host earnings</th>
                <th className="px-3 py-2">Payout</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.bookingId}>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.city || "Unknown city"}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{formatStayLabel(row)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className={`inline-flex rounded-full border px-2 py-1 ${statusTone(row.bookingStatus)}`}>
                        {row.bookingStatus.replace("_", " ")}
                      </span>
                      <span className={`inline-flex rounded-full border px-2 py-1 ${statusTone(row.paymentStatus || "none")}`}>
                        {row.paymentStatus ? `Payment ${row.paymentStatus}` : "Payment pending"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {formatMoney(row.currency, row.hostEarningsMinor)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className={`inline-flex rounded-full border px-2 py-1 ${payoutTone(row.payoutStatus)}`}>
                      {row.payoutStatus.replace("_", " ")}
                    </span>
                    {row.payoutReason ? <p className="mt-1 text-slate-500">{row.payoutReason}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    {row.bookingStatus === "pending" ? (
                      <Link
                        href={`/host/bookings?booking=${encodeURIComponent(row.bookingId)}#host-bookings`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open booking
                      </Link>
                    ) : row.payoutStatus === "pending" ? (
                      <button
                        type="button"
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        onClick={() => setRequestPayoutItem(row)}
                      >
                        Request payout
                      </button>
                    ) : row.payoutStatus === "paid" ? (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setDetailsItem(row)}
                      >
                        View details
                      </button>
                    ) : (
                      <Link
                        href={`/host/bookings?booking=${encodeURIComponent(row.bookingId)}#host-bookings`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open booking
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
          No earnings records in this view yet.
        </div>
      )}

      {requestPayoutItem ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Request payout">
          <div
            className="mx-auto mt-24 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            data-testid="host-earnings-request-payout-modal"
          >
            <h3 className="text-lg font-semibold text-slate-900">Payout request received</h3>
            <p className="mt-2 text-sm text-slate-600">
              Payouts are processed manually during pilot. Share this booking reference with support to speed up processing.
            </p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Booking: {requestPayoutItem.bookingId}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => setRequestPayoutItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailsItem ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Payout details">
          <div
            className="mx-auto mt-24 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            data-testid="host-earnings-paid-details-modal"
          >
            <h3 className="text-lg font-semibold text-slate-900">Payout details</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>Amount</dt>
                <dd className="font-semibold">{formatMoney(detailsItem.currency, detailsItem.hostEarningsMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Paid at</dt>
                <dd>{detailsItem.paidAt || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Method</dt>
                <dd>{detailsItem.payoutMethod || "Manual transfer"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Reference</dt>
                <dd>{detailsItem.payoutReference || "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => setDetailsItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
