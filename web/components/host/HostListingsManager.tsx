"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { HostFeaturedStrip } from "@/components/host/HostFeaturedStrip";
import { HostListingsMasonryGrid } from "@/components/host/HostListingsMasonryGrid";
import { buildListingApprovalGuidance } from "@/lib/host/listing-approval";
import {
  filterAndSortHostProperties,
  resolveManagerStatus,
  type HostPropertiesSort,
  type HostPropertiesStatusFilter,
} from "@/lib/host/properties-manager";
import {
  filterHostListingsByIntent,
  summarizeHostListingsPortfolio,
  type HostListingsIntentFilter,
} from "@/lib/host/listings-manager";
import {
  parseHostListingsManagerView,
  readHostListingsManagerView,
  writeHostListingsManagerView,
  type HostListingsManagerView,
} from "@/lib/host/listings-manager-view";
import { LISTING_INTENT_LABELS_PUBLIC, normalizeListingIntent } from "@/lib/listing-intents";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
  loadError?: string | null;
};

const PAGE_SIZE = 24;

const STATUS_FILTERS: Array<{ value: HostPropertiesStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "pending", label: "Pending" },
  { value: "draft", label: "Draft" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "rejected", label: "Rejected" },
  { value: "paused", label: "Paused" },
];

const INTENT_FILTERS: Array<{ value: HostListingsIntentFilter; label: string }> = [
  { value: "all", label: "All intents" },
  { value: "rent", label: "To rent" },
  { value: "sale", label: "For sale" },
  { value: "shortlet", label: "Short-lets" },
  { value: "off_plan", label: "Off-plan" },
];

function getClientStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

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

function formatPriceLabel(price: unknown, currency: string | null | undefined) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function listingLocationText(listing: DashboardListing) {
  return listing.location_label || listing.city || listing.admin_area_1 || "Location not set";
}

function listingIntentLabel(listing: DashboardListing) {
  const intent = normalizeListingIntent(listing.listing_intent ?? null);
  if (!intent) return "Intent not set";
  return LISTING_INTENT_LABELS_PUBLIC[intent];
}

export function HostListingsManager({ listings, loadError = null }: Props) {
  const searchParams = useSearchParams();
  const requestedView = parseHostListingsManagerView(searchParams.get("view"));
  const [view, setView] = useState<HostListingsManagerView>(() => {
    if (requestedView) return requestedView;
    return readHostListingsManagerView(getClientStorage());
  });
  const [status, setStatus] = useState<HostPropertiesStatusFilter>("all");
  const [intent, setIntent] = useState<HostListingsIntentFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<HostPropertiesSort>("updated");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!requestedView) return;
    writeHostListingsManagerView(getClientStorage(), requestedView);
  }, [requestedView]);

  const resolvedView = requestedView ?? view;

  const switchView = (nextView: HostListingsManagerView) => {
    const resolved = writeHostListingsManagerView(getClientStorage(), nextView);
    setView(resolved);
  };

  const stats = useMemo(() => summarizeHostListingsPortfolio(listings), [listings]);

  const filteredListings = useMemo(() => {
    const byStatus = filterAndSortHostProperties(listings, {
      status,
      search,
      sort,
    });
    return filterHostListingsByIntent(byStatus, intent);
  }, [intent, listings, search, sort, status]);

  const visibleManageRows = filteredListings.slice(0, visibleCount);
  const hasMoreManageRows = visibleCount < filteredListings.length;

  const resetPagination = () => setVisibleCount(PAGE_SIZE);

  return (
    <section className="space-y-4" data-testid="host-listings-manager">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Listings</h1>
            <p className="text-sm text-slate-600">
              Portfolio first, with manager controls one tap away.
            </p>
          </div>
          <Link href="/dashboard/properties/new">
            <Button size="sm">New listing</Button>
          </Link>
        </div>

        <div
          className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          data-testid="host-listings-stats-strip"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Portfolio: {stats.total}
          </span>
          {STATUS_FILTERS.filter((item) => item.value !== "all").map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setStatus(item.value);
                resetPagination();
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition",
                status === item.value
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              )}
              data-testid={`host-listings-stats-${item.value}`}
            >
              <span>{item.label}</span>
              <span>
                {item.value === "live"
                  ? stats.live
                  : item.value === "pending"
                    ? stats.pending
                    : item.value === "draft"
                      ? stats.draft
                      : item.value === "changes_requested"
                        ? stats.changes_requested
                        : item.value === "rejected"
                          ? stats.rejected
                          : stats.paused}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPagination();
              }}
              placeholder="Search title or location"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-listings-search"
            />
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Filters
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as HostPropertiesStatusFilter);
                resetPagination();
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-listings-filter-status"
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Intent
            <select
              value={intent}
              onChange={(event) => {
                setIntent(event.target.value as HostListingsIntentFilter);
                resetPagination();
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-listings-filter-intent"
            >
              {INTENT_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Sort
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as HostPropertiesSort);
                resetPagination();
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="host-listings-sort"
            >
              <option value="updated">Recently updated</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>

        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs shadow-sm">
          <button
            type="button"
            onClick={() => switchView("portfolio")}
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold transition",
              resolvedView === "portfolio"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
            data-testid="host-listings-view-portfolio"
            aria-pressed={resolvedView === "portfolio"}
          >
            Portfolio
          </button>
          <button
            type="button"
            onClick={() => switchView("manage")}
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold transition",
              resolvedView === "manage"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
            data-testid="host-listings-view-manage"
            aria-pressed={resolvedView === "manage"}
          >
            Manage
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}
        </div>
      ) : resolvedView === "portfolio" ? (
        <div className="space-y-3" data-testid="host-listings-portfolio-view">
          <HostFeaturedStrip listings={filteredListings} />
          <HostListingsMasonryGrid
            listings={filteredListings}
            uniformMedia
            maxListings={Math.max(filteredListings.length, 12)}
            showManageAllLink={false}
          />
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          data-testid="host-listings-manage-view"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Intent</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleManageRows.length ? (
                  visibleManageRows.map((listing) => {
                    const managerStatus = resolveManagerStatus(listing);
                    const guidance = buildListingApprovalGuidance(listing);
                    return (
                      <tr key={listing.id} data-testid={`host-listings-row-${listing.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{listing.title}</p>
                          <p className="text-xs text-slate-500">{listingLocationText(listing)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {guidance.statusLabel}
                          </span>
                          <p className="mt-1 max-w-sm text-xs text-slate-600">{guidance.summary}</p>
                          {guidance.reasonSummary ? (
                            <p className="mt-1 max-w-sm text-xs text-amber-700">{guidance.reasonSummary}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{listingIntentLabel(listing)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatPriceLabel(listing.price, listing.currency)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateLabel(listing.updated_at || listing.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
                            <Link
                              href={`/host/properties/${listing.id}/edit`}
                              className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </Link>
                            {managerStatus === "live" ? (
                              <>
                                <Link
                                  href={`/host/properties/${listing.id}/edit?step=submit`}
                                  className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                                >
                                  Pause
                                </Link>
                                <Link
                                  href={`/properties/${listing.id}`}
                                  className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                                >
                                  Open
                                </Link>
                              </>
                            ) : (
                              <Link
                                href={guidance.nextActionHref}
                                className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                              >
                                {guidance.nextActionLabel}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No listings match your current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasMoreManageRows ? (
            <div className="border-t border-slate-200 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
