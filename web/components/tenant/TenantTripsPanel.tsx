"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GuestShortletBookingSummary } from "@/lib/shortlet/shortlet.server";
import { matchesTripsFilter, resolveTripBucket, type ShortletTripsFilter } from "@/lib/shortlet/trips";

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

function statusTone(status: GuestShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (status === "pending_payment") return "text-indigo-700 bg-indigo-50 border-indigo-200";
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function shouldShowDetailsCta(row: GuestShortletBookingSummary): boolean {
  const bucket = resolveTripBucket({
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
  });
  if (bucket === "pending") return true;
  if (bucket === "upcoming" && (row.status === "confirmed" || row.status === "completed")) {
    return true;
  }
  return false;
}

export function TenantTripsPanel(props: { initialRows: GuestShortletBookingSummary[] }) {
  const [filter, setFilter] = useState<ShortletTripsFilter>("upcoming");

  const filteredRows = useMemo(
    () =>
      props.initialRows.filter((row) =>
        matchesTripsFilter({
          status: row.status,
          checkIn: row.check_in,
          checkOut: row.check_out,
          filter,
        })
      ),
    [filter, props.initialRows]
  );

  const counts = useMemo(() => {
    const buckets: Record<ShortletTripsFilter, number> = {
      upcoming: 0,
      pending: 0,
      past: 0,
      cancelled: 0,
      all: props.initialRows.length,
    };

    for (const row of props.initialRows) {
      const bucket = resolveTripBucket({
        status: row.status,
        checkIn: row.check_in,
        checkOut: row.check_out,
      });
      buckets[bucket] += 1;
    }
    return buckets;
  }, [props.initialRows]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
        <h2 className="text-xl font-semibold text-slate-900">Trips</h2>
        <p className="text-sm text-slate-600">Track your requests and upcoming stays in one place.</p>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {([
          { key: "upcoming", label: "Upcoming" },
          { key: "pending", label: "Pending" },
          { key: "past", label: "Past" },
          { key: "cancelled", label: "Cancelled" },
          { key: "all", label: "All" },
        ] as Array<{ key: ShortletTripsFilter; label: string }>).map((item) => (
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

      {filteredRows.length ? (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Listing</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Nights</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                        <p className="truncate text-xs text-slate-500">{row.city || "Unknown city"}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDate(row.check_in)} to {formatDate(row.check_out)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.nights}</td>
                    <td className="px-3 py-2 text-slate-700">{formatMoney(row.currency, row.total_amount_minor)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {shouldShowDetailsCta(row) ? (
                          <Link
                            href={`/trips/${row.id}`}
                            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View details
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {filteredRows.map((row) => (
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
                  <p className="col-span-2">{formatDate(row.check_in)} to {formatDate(row.check_out)}</p>
                  <p>Nights: {row.nights}</p>
                  <p>Total: {formatMoney(row.currency, row.total_amount_minor)}</p>
                  <p className="col-span-2">Created: {formatDateTime(row.created_at)}</p>
                </div>
                {shouldShowDetailsCta(row) ? (
                  <div className="mt-3">
                    <Link
                      href={`/trips/${row.id}`}
                      className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View details
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">No trips yet. Browse shortlets.</p>
          <Link href="/properties?intent=rent" className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-2">
            Browse shortlets
          </Link>
        </div>
      )}
    </div>
  );
}
