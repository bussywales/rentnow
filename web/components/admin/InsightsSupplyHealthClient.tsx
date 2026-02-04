"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type SupplyHealthRow = {
  id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  owner_name: string | null;
  owner_id: string | null;
  updated_at: string | null;
  expires_at: string | null;
  is_featured: boolean | null;
  quality_score: number;
  missing_flags: string[];
  views: number;
  enquiries: number;
};

type Props = {
  initialRows: SupplyHealthRow[];
};

const FLAG_LABELS: Record<string, string> = {
  no_photos: "No photos",
  few_photos: "Few photos",
  short_title: "Short title",
  no_description: "No description",
  short_description: "Short description",
  no_price: "Missing price",
  no_location: "Missing location",
  no_intent: "Missing intent",
  not_live: "Not live",
};

function isExpiringSoon(value?: string | null) {
  if (!value) return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  const diff = ts - Date.now();
  return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

export default function InsightsSupplyHealthClient({ initialRows }: Props) {
  const [rows, setRows] = useState<SupplyHealthRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [scoreOnly, setScoreOnly] = useState(true);
  const [noEnquiriesOnly, setNoEnquiriesOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (scoreOnly && row.quality_score >= 60) return false;
      if (noEnquiriesOnly && row.enquiries > 0) return false;
      if (expiringOnly && !isExpiringSoon(row.expires_at)) return false;
      if (featuredOnly && !row.is_featured) return false;
      if (query) {
        const haystack = `${row.title ?? ""} ${row.city ?? ""} ${row.owner_name ?? ""}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, scoreOnly, noEnquiriesOnly, expiringOnly, featuredOnly, query]);

  async function updateFeatured(row: SupplyHealthRow, nextFeatured: boolean) {
    setBusyId(row.id);
    setError(null);
    try {
      const payload = nextFeatured
        ? { is_featured: true }
        : { is_featured: false, featured_rank: null, featured_until: null };
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
          item.id === row.id ? { ...item, is_featured: updated?.is_featured ?? nextFeatured } : item
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, city, or host"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
            data-testid="supply-health-search"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scoreOnly}
              onChange={(event) => setScoreOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              data-testid="supply-health-filter-score"
            />
            Score &lt; 60
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noEnquiriesOnly}
              onChange={(event) => setNoEnquiriesOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              data-testid="supply-health-filter-no-enquiries"
            />
            No enquiries
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(event) => setExpiringOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              data-testid="supply-health-filter-expiring"
            />
            Expiring soon
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(event) => setFeaturedOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              data-testid="supply-health-filter-featured"
            />
            Featured only
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="supply-health-table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Listing</th>
                <th className="px-4 py-3 text-left font-semibold">Host</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
                <th className="px-4 py-3 text-left font-semibold">Flags</th>
                <th className="px-4 py-3 text-right font-semibold">Views</th>
                <th className="px-4 py-3 text-right font-semibold">Enquiries</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    No listings match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} data-testid={`supply-health-row-${row.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{row.title || "Untitled"}</p>
                      <p className="text-xs text-slate-500">{row.city || "Unknown"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{row.owner_name || "Host"}</p>
                      <p className="text-[11px] text-slate-500">{row.status || "unknown"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                        {row.quality_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.missing_flags.length ? (
                          row.missing_flags.map((flag) => (
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
                    <td className="px-4 py-3 text-right text-slate-700">{row.views}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.enquiries}</td>
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
                        <button
                          type="button"
                          disabled
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-400"
                        >
                          Message host
                        </button>
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
