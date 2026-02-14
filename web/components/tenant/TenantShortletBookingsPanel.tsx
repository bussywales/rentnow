"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { GuestShortletBookingSummary } from "@/lib/shortlet/shortlet.server";
import { classifyShortletBookingWindow } from "@/lib/shortlet/access";

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

function statusTone(status: GuestShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

export function TenantShortletBookingsPanel(props: { initialRows: GuestShortletBookingSummary[] }) {
  const [rows, setRows] = useState<GuestShortletBookingSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const upcomingRows = useMemo(
    () =>
      rows.filter((row) => {
        const bucket = classifyShortletBookingWindow({
          status: row.status,
          checkIn: row.check_in,
          checkOut: row.check_out,
        });
        return bucket === "incoming" || bucket === "upcoming";
      }),
    [rows]
  );
  const pastRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          classifyShortletBookingWindow({
            status: row.status,
            checkIn: row.check_in,
            checkOut: row.check_out,
          }) === "past"
      ),
    [rows]
  );

  async function cancelBooking(bookingId: string) {
    if (!bookingId || busyId) return;
    setBusyId(bookingId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${bookingId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { status?: string }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to cancel booking");
      }
      setRows((prev) =>
        prev.map((row) => (row.id === bookingId ? { ...row, status: "cancelled", expires_at: null } : row))
      );
      setNotice("Booking cancelled.");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel booking");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
        <h2 className="text-xl font-semibold text-slate-900">My bookings</h2>
        <p className="text-sm text-slate-600">
          Track upcoming stays, request updates, and review booking outcomes.
        </p>
      </div>

      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Upcoming and pending</h3>
        {upcomingRows.length ? (
          <div className="mt-2 space-y-2">
            {upcomingRows.map((row) => {
              const canCancel = row.status === "pending" || row.status === "confirmed";
              return (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                      <p className="text-xs text-slate-600">
                        {formatDate(row.check_in)} to {formatDate(row.check_out)} · {row.nights} night
                        {row.nights === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-slate-600">
                        Host: {row.host_name || row.host_user_id}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  {row.expires_at ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Action needed before {new Date(row.expires_at).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatMoney(row.currency, row.total_amount_minor)}
                    </span>
                    <Link
                      href={`/properties/${row.property_id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View listing
                    </Link>
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void cancelBooking(row.id)}
                        disabled={busyId === row.id}
                      >
                        {busyId === row.id ? "Cancelling..." : "Cancel booking"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No upcoming shortlet bookings yet.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Past bookings</h3>
        {pastRows.length ? (
          <div className="mt-2 space-y-2">
            {pastRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                  <p className="text-xs text-slate-600">
                    {formatDate(row.check_in)} to {formatDate(row.check_out)} · {formatMoney(row.currency, row.total_amount_minor)}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No past shortlet bookings yet.</p>
        )}
      </div>
    </div>
  );
}
