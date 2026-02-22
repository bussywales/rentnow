"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  formatRespondByCountdownLabel,
  parseHostBookingInboxFilterParam,
  parseHostBookingQueryParam,
  resolveHostBookingInboxFilter,
  resolveRespondByIso,
  rowMatchesHostBookingInboxFilter,
  sortHostBookingInboxRows,
  type HostBookingInboxFilter,
} from "@/lib/shortlet/host-bookings-inbox";
import type {
  HostShortletBookingSummary,
  HostShortletSettingSummary,
} from "@/lib/shortlet/shortlet.server";

type BookingAction = "approve" | "decline";

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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}

function statusTone(status: HostShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function maskGuestLabel(row: HostShortletBookingSummary): string {
  const raw = (row.guest_name || row.guest_user_id || "guest").trim();
  if (!raw) return "Guest";
  if (raw.includes("@")) {
    const [local, domain] = raw.split("@");
    const localSafe = local.length > 1 ? `${local[0]}***` : "***";
    return `${localSafe}@${domain || "***"}`;
  }
  if (raw.length <= 2) return `${raw[0] || "G"}*`;
  return `${raw.slice(0, 2)}***`;
}

function resolveRespondActionState(input: {
  status: HostShortletBookingSummary["status"];
  bookingMode: "request" | "instant";
}) {
  if (input.status !== "pending") {
    return {
      canRespond: false,
      reason: "Only pending requests can be approved or declined.",
    };
  }
  if (input.bookingMode !== "request") {
    return {
      canRespond: false,
      reason: "Instant bookings are auto-confirmed and cannot be manually approved.",
    };
  }
  return {
    canRespond: true,
    reason: null,
  };
}

export function HostShortletBookingsPanel(props: {
  initialRows: HostShortletBookingSummary[];
  settingsRows?: HostShortletSettingSummary[];
  focusBookingId?: string | null;
}) {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<HostShortletBookingSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<HostBookingInboxFilter>("awaiting_approval");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [highlightBookingId, setHighlightBookingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setRows(props.initialRows);
  }, [props.initialRows]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const targetId = parseHostBookingQueryParam(props.focusBookingId);
    if (!targetId) return;

    const target = rows.find((row) => row.id.toLowerCase() === targetId);
    if (!target) {
      setNotice("The linked booking was not found. It may have been archived.");
      return;
    }

    setFilter(resolveHostBookingInboxFilter(target));
    setSelectedBookingId(target.id);
    setHighlightBookingId(target.id);

    const clearTimer = window.setTimeout(() => {
      setHighlightBookingId((current) => (current === target.id ? null : current));
    }, 4_500);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const rowElement = document.getElementById(`host-booking-row-${target.id}`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    });

    return () => window.clearTimeout(clearTimer);
  }, [props.focusBookingId, rows]);

  useEffect(() => {
    if (parseHostBookingQueryParam(props.focusBookingId)) return;
    const requestedFilter = parseHostBookingInboxFilterParam(searchParams?.get("view"));
    if (!requestedFilter) return;
    setFilter(requestedFilter);
  }, [props.focusBookingId, searchParams]);

  const bookingModeByProperty = useMemo(() => {
    return new Map((props.settingsRows || []).map((row) => [row.property_id, row.booking_mode]));
  }, [props.settingsRows]);

  const filteredRows = useMemo(
    () =>
      sortHostBookingInboxRows(
        rows.filter((row) => rowMatchesHostBookingInboxFilter(row, filter)),
        filter
      ),
    [filter, rows]
  );

  const counts = useMemo(() => {
    return {
      awaiting_approval: rows.filter((row) => resolveHostBookingInboxFilter(row) === "awaiting_approval").length,
      upcoming: rows.filter((row) => resolveHostBookingInboxFilter(row) === "upcoming").length,
      past: rows.filter((row) => resolveHostBookingInboxFilter(row) === "past").length,
      closed: rows.filter((row) => resolveHostBookingInboxFilter(row) === "closed").length,
    } as Record<HostBookingInboxFilter, number>;
  }, [rows]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedBookingId) || null,
    [rows, selectedBookingId]
  );

  async function decide(row: HostShortletBookingSummary, action: BookingAction) {
    if (!row.id || busyId) return;
    const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
    const actionState = resolveRespondActionState({ status: row.status, bookingMode });
    if (!actionState.canRespond) {
      setError(actionState.reason);
      return;
    }

    setBusyId(row.id);
    setError(null);
    setNotice(null);

    try {
      const reason =
        action === "decline"
          ? window.prompt("Reason for decline (optional)", "Dates not available")?.trim() || undefined
          : undefined;
      const endpoint = action === "approve" ? "approve" : "decline";
      const response = await fetch(`/api/shortlet/bookings/${row.id}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { status?: HostShortletBookingSummary["status"] }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update booking");
      }
      const fallbackStatus = action === "approve" ? "confirmed" : "declined";
      const nextStatus = payload?.booking?.status ?? fallbackStatus;
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: nextStatus,
                respond_by: null,
                expires_at: null,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      setNotice(action === "approve" ? "Booking approved." : "Booking declined.");
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Unable to update booking");
    } finally {
      setBusyId(null);
    }
  }

  const filters: Array<{ key: HostBookingInboxFilter; label: string }> = [
    { key: "awaiting_approval", label: "Awaiting approval" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h3 className="text-lg font-semibold text-slate-900">Bookings inbox</h3>
          <p className="text-sm text-slate-600">
            Review requests, respond in under 12 hours, and track upcoming and closed stays.
          </p>
        </div>
        <Link
          href="/host/shortlets/blocks"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Manage blocks
        </Link>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === item.key
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">Response SLA for request bookings: 12 hours.</p>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}

      {filteredRows.length ? (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Listing</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Nights</th>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Respond by</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
                  const actionState = resolveRespondActionState({
                    status: row.status,
                    bookingMode,
                  });
                  const respondByIso = resolveRespondByIso(row);
                  const rowHighlighted = highlightBookingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      id={`host-booking-row-${row.id}`}
                      className={rowHighlighted ? "bg-sky-50/70" : undefined}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingId(row.id)}
                          className="min-w-0 text-left"
                        >
                          <div className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</div>
                          <div className="truncate text-xs text-slate-500">{row.city || "Unknown city"}</div>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatDate(row.check_in)} to {formatDate(row.check_out)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.nights}</td>
                      <td className="px-3 py-2 text-slate-700">{maskGuestLabel(row)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatMoney(row.currency, row.total_amount_minor)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {row.status === "pending"
                          ? formatRespondByCountdownLabel(respondByIso, nowMs)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedBookingId(row.id)}
                          >
                            View
                          </Button>
                          {actionState.canRespond ? (
                            <>
                              <Button size="sm" onClick={() => void decide(row, "approve")} disabled={busyId === row.id}>
                                {busyId === row.id ? "Updating..." : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void decide(row, "decline")}
                                disabled={busyId === row.id}
                              >
                                Decline
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2 md:hidden">
            {filteredRows.map((row) => {
              const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
              const actionState = resolveRespondActionState({
                status: row.status,
                bookingMode,
              });
              const respondByIso = resolveRespondByIso(row);
              const rowHighlighted = highlightBookingId === row.id;

              return (
                <div
                  key={row.id}
                  id={`host-booking-row-${row.id}`}
                  className={`rounded-xl border p-3 ${
                    rowHighlighted ? "border-sky-300 bg-sky-50/70" : "border-slate-200"
                  }`}
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBookingId(row.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                      <p className="text-xs text-slate-500">{row.city || "Unknown city"}</p>
                    </button>
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p>Dates: {formatDate(row.check_in)} to {formatDate(row.check_out)}</p>
                    <p>Nights: {row.nights}</p>
                    <p>Guest: {maskGuestLabel(row)}</p>
                    <p>Total: {formatMoney(row.currency, row.total_amount_minor)}</p>
                    <p>Created: {formatDateTime(row.created_at)}</p>
                    <p>
                      Respond by:{" "}
                      {row.status === "pending"
                        ? formatRespondByCountdownLabel(respondByIso, nowMs)
                        : "—"}
                    </p>
                  </div>
                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedBookingId(row.id)}>
                      View details
                    </Button>
                    {actionState.canRespond ? (
                      <>
                        <Button size="sm" onClick={() => void decide(row, "approve")} disabled={busyId === row.id}>
                          {busyId === row.id ? "Updating..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void decide(row, "decline")}
                          disabled={busyId === row.id}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
          No bookings in this view yet.
        </div>
      )}

      {selectedRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Booking details"
        >
          <div className="h-[86vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Booking details</p>
                <p className="truncate text-xs text-slate-500">{selectedRow.property_title || "Shortlet listing"}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                onClick={() => setSelectedBookingId(null)}
                aria-label="Close booking details"
              >
                x
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-4 py-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Guest</p>
                  <p className="font-medium text-slate-900">{maskGuestLabel(selectedRow)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(selectedRow.status)}`}>
                      {selectedRow.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Check-in</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedRow.check_in)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Check-out</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedRow.check_out)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Nights</p>
                  <p className="font-medium text-slate-900">{selectedRow.nights}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p>
                  <p className="font-medium text-slate-900">
                    {formatMoney(selectedRow.currency, selectedRow.total_amount_minor)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Created</p>
                  <p className="font-medium text-slate-900">{formatDateTime(selectedRow.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Respond by</p>
                  <p className="font-medium text-slate-900">
                    {selectedRow.status === "pending"
                      ? formatRespondByCountdownLabel(resolveRespondByIso(selectedRow), nowMs)
                      : "Not required"}
                  </p>
                </div>
              </div>

              {(() => {
                const bookingMode = bookingModeByProperty.get(selectedRow.property_id) || "request";
                const actionState = resolveRespondActionState({
                  status: selectedRow.status,
                  bookingMode,
                });
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Host response window for request bookings is 12 hours.
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void decide(selectedRow, "approve")}
                        disabled={busyId === selectedRow.id || !actionState.canRespond}
                        title={actionState.reason ?? undefined}
                      >
                        {busyId === selectedRow.id ? "Updating..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void decide(selectedRow, "decline")}
                        disabled={busyId === selectedRow.id || !actionState.canRespond}
                        title={actionState.reason ?? undefined}
                      >
                        Decline
                      </Button>
                      <Link
                        href="/host/shortlets/blocks"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Manage availability
                      </Link>
                    </div>
                    {!actionState.canRespond && actionState.reason ? (
                      <p className="text-xs text-slate-500">{actionState.reason}</p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
