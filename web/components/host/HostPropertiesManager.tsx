"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { buildListingApprovalGuidance } from "@/lib/host/listing-approval";
import type { DashboardListing } from "@/lib/properties/host-dashboard";
import {
  countByManagerStatus,
  filterAndSortHostProperties,
  resolveManagerStatus,
  type HostPropertiesSort,
  type HostPropertiesStatusFilter,
} from "@/lib/host/properties-manager";

type Props = {
  listings: DashboardListing[];
};

const FILTERS: Array<{ value: HostPropertiesStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "pending", label: "Pending" },
  { value: "draft", label: "Draft" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "rejected", label: "Rejected" },
  { value: "paused", label: "Paused" },
];

const PAGE_SIZE = 20;

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function managerStatusChipClass(status: HostPropertiesStatusFilter | Exclude<HostPropertiesStatusFilter, "all">) {
  switch (status) {
    case "live":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "paused":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "changes_requested":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function HostPropertiesManager({ listings }: Props) {
  const [status, setStatus] = useState<HostPropertiesStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<HostPropertiesSort>("updated");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const counts = useMemo(() => countByManagerStatus(listings), [listings]);

  const filteredListings = useMemo(
    () =>
      filterAndSortHostProperties(listings, {
        status,
        search,
        sort,
      }),
    [listings, search, sort, status]
  );

  const visibleListings = filteredListings.slice(0, visibleCount);
  const hasMore = visibleCount < filteredListings.length;

  const applyStatusFilter = (value: HostPropertiesStatusFilter) => {
    setStatus(value);
    setVisibleCount(PAGE_SIZE);
  };

  const applySearch = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  const applySort = (value: HostPropertiesSort) => {
    setSort(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <section className="space-y-4" data-testid="host-properties-manager">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Manage listings</h2>
            <p className="text-sm text-slate-600">
              Filter, review status, and open any listing editor from one place.
            </p>
          </div>
          <Link href="/dashboard/properties/new">
            <Button size="sm">New listing</Button>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="host-properties-manager-filters">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => applyStatusFilter(filter.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                status === filter.value
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
              data-testid={`host-properties-filter-${filter.value}`}
              aria-pressed={status === filter.value}
            >
              <span>{filter.label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                {counts[filter.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]" data-testid="host-properties-manager-controls">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Search
            <input
              value={search}
              onChange={(event) => applySearch(event.target.value)}
              placeholder="Search title or location"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-properties-manager-search"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Sort
            <select
              value={sort}
              onChange={(event) => applySort(event.target.value as HostPropertiesSort)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-properties-manager-sort"
            >
              <option value="updated">Recently updated</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="host-properties-manager-results">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleListings.length ? (
                visibleListings.map((listing) => {
                  const managerStatus = resolveManagerStatus(listing);
                  const guidance = buildListingApprovalGuidance(listing);
                  return (
                    <tr key={listing.id} data-testid={`host-properties-row-${listing.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{listing.title}</p>
                        <p className="text-xs text-slate-500">
                          {listing.location_label || listing.city || listing.admin_area_1 || "Location not set"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
                            managerStatusChipClass(managerStatus)
                          )}
                        >
                          {guidance.statusLabel}
                        </span>
                        <p className="mt-1 max-w-sm text-xs text-slate-600">{guidance.summary}</p>
                        {guidance.reasonSummary ? (
                          <p className="mt-1 max-w-sm text-xs text-amber-700">{guidance.reasonSummary}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateLabel(listing.updated_at || listing.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/host/properties/${listing.id}/edit`}
                          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                        >
                          Open editor
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    No listings match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              data-testid="host-properties-load-more"
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
