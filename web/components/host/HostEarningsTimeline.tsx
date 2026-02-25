"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildMoneyDisplayLines,
  formatCurrencyMinor,
  sortCurrencyMinorTotals,
  type CurrencyMinorTotals,
} from "@/lib/money/multi-currency";
import type { HostEarningsTimeline, HostEarningsTimelineItem } from "@/lib/shortlet/host-earnings";

type EarningsTab = "available" | "upcoming" | "paid" | "all";

function formatMoney(currency: string, amountMinor: number): string {
  return formatCurrencyMinor(currency, amountMinor, { locale: "en-NG" });
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

function isMultiCurrencyTotal(totals: CurrencyMinorTotals) {
  return sortCurrencyMinorTotals(totals).length > 1;
}

export function HostEarningsTimelineView(props: { timeline: HostEarningsTimeline }) {
  const [tab, setTab] = useState<EarningsTab>("available");
  const [detailsItem, setDetailsItem] = useState<HostEarningsTimelineItem | null>(null);
  const [requestPayoutItem, setRequestPayoutItem] = useState<HostEarningsTimelineItem | null>(null);
  const [requestPayoutMethod, setRequestPayoutMethod] = useState("bank_transfer");
  const [requestPayoutNote, setRequestPayoutNote] = useState("");
  const [requestingBookingId, setRequestingBookingId] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestedBookingIds, setRequestedBookingIds] = useState<Record<string, true>>({});
  const rows = props.timeline.items;
  const fallbackCurrency = rows[0]?.currency || "NGN";
  const availableToPayoutLines = useMemo(
    () =>
      buildMoneyDisplayLines({
        totals: props.timeline.summary.availableToPayoutByCurrencyMinor,
        fallbackCurrency,
        fallbackAmountMinor: props.timeline.summary.availableToPayoutMinor,
        preferredCurrency: fallbackCurrency,
        locale: "en-NG",
      }),
    [
      fallbackCurrency,
      props.timeline.summary.availableToPayoutByCurrencyMinor,
      props.timeline.summary.availableToPayoutMinor,
    ]
  );
  const paidOutLines = useMemo(
    () =>
      buildMoneyDisplayLines({
        totals: props.timeline.summary.paidOutByCurrencyMinor,
        fallbackCurrency,
        fallbackAmountMinor: props.timeline.summary.paidOutMinor,
        preferredCurrency: fallbackCurrency,
        locale: "en-NG",
      }),
    [fallbackCurrency, props.timeline.summary.paidOutByCurrencyMinor, props.timeline.summary.paidOutMinor]
  );
  const grossEarningsLines = useMemo(
    () =>
      buildMoneyDisplayLines({
        totals: props.timeline.summary.grossEarningsByCurrencyMinor,
        fallbackCurrency,
        fallbackAmountMinor: props.timeline.summary.grossEarningsMinor,
        preferredCurrency: fallbackCurrency,
        locale: "en-NG",
      }),
    [fallbackCurrency, props.timeline.summary.grossEarningsByCurrencyMinor, props.timeline.summary.grossEarningsMinor]
  );
  const showsMultiCurrencyHint =
    isMultiCurrencyTotal(props.timeline.summary.availableToPayoutByCurrencyMinor) ||
    isMultiCurrencyTotal(props.timeline.summary.paidOutByCurrencyMinor) ||
    isMultiCurrencyTotal(props.timeline.summary.grossEarningsByCurrencyMinor);
  const todayMs = useMemo(() => {
    const today = new Date();
    return Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }, []);
  const visibleRows = useMemo(
    () => resolveRowsForTab({ tab, rows, todayMs }),
    [rows, tab, todayMs]
  );

  function openRequestModal(row: HostEarningsTimelineItem) {
    setRequestError(null);
    setRequestNotice(null);
    setRequestPayoutMethod("bank_transfer");
    setRequestPayoutNote("");
    setRequestPayoutItem(row);
  }

  async function submitPayoutRequest() {
    if (!requestPayoutItem || requestingBookingId) return;
    setRequestError(null);
    setRequestNotice(null);
    setRequestingBookingId(requestPayoutItem.bookingId);
    try {
      const response = await fetch("/api/host/shortlets/payouts/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: requestPayoutItem.bookingId,
          payoutMethod: requestPayoutMethod,
          note: requestPayoutNote.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; alreadyRequested?: boolean; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to request payout");
      }
      setRequestedBookingIds((prev) => ({
        ...prev,
        [requestPayoutItem.bookingId]: true,
      }));
      setRequestNotice(
        payload?.alreadyRequested
          ? "Payout request already exists in the admin queue."
          : "Payout request sent to admin queue."
      );
      setRequestPayoutItem(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to request payout");
    } finally {
      setRequestingBookingId(null);
    }
  }

  return (
    <section className="space-y-4" data-testid="host-earnings-timeline">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Available to payout</p>
          <div className="mt-1 text-lg font-semibold text-slate-900" data-testid="host-earnings-summary-available">
            {availableToPayoutLines.map((line, index) => (
              <p key={`${line}-${index}`} className={index === 0 ? "leading-tight" : "text-base leading-tight"}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Paid out</p>
          <div className="mt-1 text-lg font-semibold text-slate-900" data-testid="host-earnings-summary-paid">
            {paidOutLines.map((line, index) => (
              <p key={`${line}-${index}`} className={index === 0 ? "leading-tight" : "text-base leading-tight"}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Gross earnings</p>
          <div className="mt-1 text-lg font-semibold text-slate-900" data-testid="host-earnings-summary-gross">
            {grossEarningsLines.map((line, index) => (
              <p key={`${line}-${index}`} className={index === 0 ? "leading-tight" : "text-base leading-tight"}>
                {line}
              </p>
            ))}
          </div>
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
      {showsMultiCurrencyHint ? (
        <p className="text-xs text-slate-500" data-testid="host-earnings-multi-currency-hint">
          Totals shown by currency.
        </p>
      ) : null}

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
                    {requestedBookingIds[row.bookingId] || row.payoutRequestStatus === "requested" ? (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-700">
                        Requested
                      </p>
                    ) : null}
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
                        onClick={() => openRequestModal(row)}
                        disabled={
                          !!requestedBookingIds[row.bookingId] || row.payoutRequestStatus === "requested"
                        }
                      >
                        {requestedBookingIds[row.bookingId] || row.payoutRequestStatus === "requested"
                          ? "Requested"
                          : "Request payout"}
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
            <h3 className="text-lg font-semibold text-slate-900">Request payout</h3>
            <p className="mt-2 text-sm text-slate-600">
              Payouts are processed manually during pilot. Send this request to add it to the admin payout queue.
            </p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">Booking: {requestPayoutItem.bookingId}</p>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Payout method
              <select
                value={requestPayoutMethod}
                onChange={(event) => setRequestPayoutMethod(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Note (optional)
              <textarea
                value={requestPayoutNote}
                onChange={(event) => setRequestPayoutNote(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                placeholder="Any payout context for admin ops."
              />
            </label>
            {requestError ? <p className="mt-2 text-sm text-rose-600">{requestError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={() => setRequestPayoutItem(null)}
                disabled={requestingBookingId === requestPayoutItem.bookingId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => void submitPayoutRequest()}
                disabled={requestingBookingId === requestPayoutItem.bookingId}
              >
                {requestingBookingId === requestPayoutItem.bookingId ? "Sending..." : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestNotice ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
          {requestNotice}
        </p>
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
