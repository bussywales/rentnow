"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { HostShortletBookingSummary } from "@/lib/shortlet/shortlet.server";

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

function statusTone(status: HostShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

export function HostShortletBookingsPanel(props: { initialRows: HostShortletBookingSummary[] }) {
  const [rows, setRows] = useState<HostShortletBookingSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingRows = useMemo(() => rows.filter((row) => row.status === "pending"), [rows]);
  const confirmedRows = useMemo(
    () => rows.filter((row) => row.status === "confirmed" || row.status === "completed").slice(0, 8),
    [rows]
  );

  async function respond(bookingId: string, action: "accept" | "decline") {
    if (!bookingId || busyId) return;
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${bookingId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { status?: HostShortletBookingSummary["status"] }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update booking");
      }
      const nextStatus = payload?.booking?.status ?? (action === "accept" ? "confirmed" : "declined");
      setRows((prev) =>
        prev.map((row) => (row.id === bookingId ? { ...row, status: nextStatus, expires_at: null } : row))
      );
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : "Unable to update booking");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlet bookings</p>
          <h3 className="text-lg font-semibold text-slate-900">Manage booking requests</h3>
          <p className="text-sm text-slate-600">Accept or decline requests, then keep your availability blocks updated.</p>
        </div>
        <Link
          href="/host/shortlets/blocks"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Calendar blocks
        </Link>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">Pending requests</p>
        {pendingRows.length ? (
          <div className="mt-2 space-y-2">
            {pendingRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                    Pending
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {formatDate(row.check_in)} to {formatDate(row.check_out)} · {row.nights} night
                  {row.nights === 1 ? "" : "s"} · {formatMoney(row.currency, row.total_amount_minor)}
                </p>
                {row.expires_at ? (
                  <p className="mt-1 text-xs text-amber-700">Expires {new Date(row.expires_at).toLocaleString()}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => respond(row.id, "accept")}
                    disabled={busyId === row.id}
                  >
                    {busyId === row.id ? "Updating..." : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => respond(row.id, "decline")}
                    disabled={busyId === row.id}
                  >
                    Decline
                  </Button>
                  <Link
                    href={`/dashboard/properties/${row.property_id}`}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open listing
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No pending shortlet requests right now.</p>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-900">Confirmed bookings</p>
        {confirmedRows.length ? (
          <div className="mt-2 space-y-2">
            {confirmedRows.map((row) => (
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
          <p className="mt-2 text-sm text-slate-600">No confirmed shortlet bookings yet.</p>
        )}
      </div>
    </section>
  );
}

