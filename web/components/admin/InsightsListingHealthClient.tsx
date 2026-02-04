"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ListingHealthRow = {
  id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  updated_at: string | null;
  expires_at: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  views_7d: number;
  leads_14d: number;
  views_range: number;
  flags: string[];
};

type Props = {
  initialRows: ListingHealthRow[];
  initialStatus?: string;
  initialFlag?: string;
  initialQuery?: string;
};

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  paused_owner: "Paused (Owner)",
  paused_occupied: "Paused (Occupied)",
  expired: "Expired",
  draft: "Draft",
  pending: "Pending",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

const FLAG_LABELS: Record<string, string> = {
  zero_views: "0 views",
  zero_enquiries: "0 enquiries",
  paused_demand: "Paused + demand",
  expiring_soon: "Expiring soon",
};

const FLAG_OPTIONS = [
  { value: "", label: "All flags" },
  { value: "zero_views", label: "0 views" },
  { value: "zero_enquiries", label: "0 enquiries" },
  { value: "paused_demand", label: "Paused + demand" },
  { value: "expiring_soon", label: "Expiring soon" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "paused_owner", label: "Paused (Owner)" },
  { value: "paused_occupied", label: "Paused (Occupied)" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "rejected", label: "Rejected" },
];

export default function InsightsListingHealthClient({
  initialRows,
  initialStatus = "",
  initialFlag = "",
  initialQuery = "",
}: Props) {
  const [rows, setRows] = useState<ListingHealthRow[]>(initialRows);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [flagFilter, setFlagFilter] = useState(initialFlag);
  const [query, setQuery] = useState(initialQuery);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (flagFilter && !row.flags.includes(flagFilter)) return false;
      if (query) {
        const haystack = `${row.title ?? ""} ${row.city ?? ""}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, statusFilter, flagFilter, query]);

  async function updateFeatured(row: ListingHealthRow, nextFeatured: boolean, extendDays?: number) {
    setBusyId(row.id);
    setError(null);
    try {
      const payload: { is_featured: boolean; featured_until?: string | null; featured_rank?: number | null } = {
        is_featured: nextFeatured,
      };
      if (!nextFeatured) {
        payload.featured_until = null;
        payload.featured_rank = null;
      } else if (extendDays) {
        const nextUntil = new Date(Date.now() + extendDays * 24 * 60 * 60 * 1000).toISOString();
        payload.featured_until = nextUntil;
      }

      const res = await fetch(`/api/admin/properties/${row.id}/featured`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = await res.json();
      const updated = data?.property ?? data?.data ?? data;
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                is_featured: updated?.is_featured ?? nextFeatured,
                featured_until: updated?.featured_until ?? payload.featured_until ?? item.featured_until,
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update featured state.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or city"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
            data-testid="listing-health-search"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            data-testid="listing-health-filter-status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={flagFilter}
            onChange={(event) => setFlagFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            data-testid="listing-health-filter-flag"
          >
            {FLAG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="listing-health-table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Listing</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Views (7d)</th>
                <th className="px-4 py-3 text-right font-semibold">Leads (14d)</th>
                <th className="px-4 py-3 text-left font-semibold">Flags</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No listings match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} data-testid={`listing-health-row-${row.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{row.title || "Untitled"}</p>
                      <p className="text-xs text-slate-500">{row.city || "Unknown"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {STATUS_LABELS[row.status ?? ""] ?? row.status ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.views_7d}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.leads_14d}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.flags.length ? (
                          row.flags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                            >
                              {FLAG_LABELS[flag] ?? flag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/listings?property=${row.id}`}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Open
                        </Link>
                        {row.is_featured ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => updateFeatured(row, false)}
                            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                          >
                            Unfeature
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => updateFeatured(row, true)}
                            className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            Feature
                          </button>
                        )}
                        {row.is_featured ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => updateFeatured(row, true, 14)}
                            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                          >
                            Extend 14d
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
