"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type {
  HostShortletBookingSummary,
  HostShortletSettingSummary,
} from "@/lib/shortlet/shortlet.server";

type BookingFilter = "pending" | "confirmed" | "cancelled" | "all";
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

function normalizeFilterStatus(status: HostShortletBookingSummary["status"]): BookingFilter {
  if (status === "pending") return "pending";
  if (status === "confirmed" || status === "completed") return "confirmed";
  return "cancelled";
}

function matchesFilter(status: HostShortletBookingSummary["status"], filter: BookingFilter): boolean {
  if (filter === "all") return true;
  return normalizeFilterStatus(status) === filter;
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

export function HostShortletBookingsPanel(props: {
  initialRows: HostShortletBookingSummary[];
  settingsRows?: HostShortletSettingSummary[];
}) {
  const [rows, setRows] = useState<HostShortletBookingSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>("pending");

  useEffect(() => {
    setRows(props.initialRows);
  }, [props.initialRows]);

  const bookingModeByProperty = useMemo(() => {
    return new Map((props.settingsRows || []).map((row) => [row.property_id, row.booking_mode]));
  }, [props.settingsRows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilter(row.status, filter)),
    [filter, rows]
  );

  const counts = useMemo(() => {
    return {
      pending: rows.filter((row) => normalizeFilterStatus(row.status) === "pending").length,
      confirmed: rows.filter((row) => normalizeFilterStatus(row.status) === "confirmed").length,
      cancelled: rows.filter((row) => normalizeFilterStatus(row.status) === "cancelled").length,
      all: rows.length,
    };
  }, [rows]);

  async function decide(row: HostShortletBookingSummary, action: BookingAction) {
    if (!row.id || busyId) return;
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
          item.id === row.id ? { ...item, status: nextStatus, expires_at: null } : item
        )
      );
      setNotice(action === "approve" ? "Booking approved." : "Booking declined.");
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Unable to update booking");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h3 className="text-lg font-semibold text-slate-900">Bookings inbox</h3>
          <p className="text-sm text-slate-600">Review requests and manage booking status for your shortlet listings.</p>
        </div>
        <Link
          href="/host/shortlets/blocks"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Manage blocks
        </Link>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {([
          { key: "pending", label: "Pending" },
          { key: "confirmed", label: "Confirmed" },
          { key: "cancelled", label: "Cancelled" },
          { key: "all", label: "All" },
        ] as Array<{ key: BookingFilter; label: string }>).map((item) => (
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
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
                  const canHostDecide = row.status === "pending" && bookingMode === "request";
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</div>
                          <div className="truncate text-xs text-slate-500">{row.city || "Unknown city"}</div>
                        </div>
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
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          {canHostDecide ? (
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
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
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
              const canHostDecide = row.status === "pending" && bookingMode === "request";
              return (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                      <p className="text-xs text-slate-500">{row.city || "Unknown city"}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p>Dates: {formatDate(row.check_in)} to {formatDate(row.check_out)}</p>
                    <p>Nights: {row.nights}</p>
                    <p>Guest: {maskGuestLabel(row)}</p>
                    <p>Total: {formatMoney(row.currency, row.total_amount_minor)}</p>
                    <p className="col-span-2">Created: {formatDateTime(row.created_at)}</p>
                  </div>
                  {canHostDecide ? (
                    <div className="mt-3 flex min-w-0 flex-wrap gap-2">
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
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
          No bookings in this filter yet.
        </div>
      )}
    </section>
  );
}
