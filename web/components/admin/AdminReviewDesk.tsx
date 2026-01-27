"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import {
  parseSelectedId,
  type AdminReviewListItem,
  formatLocationLine,
  filterAndSortListings,
  type AdminReviewFilters,
} from "@/lib/admin/admin-review";
import { AdminReviewDrawer } from "./AdminReviewDrawer";
import { AdminReviewList } from "./AdminReviewList";
import { useAdminReviewView } from "@/lib/admin/admin-review-view";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
};

export function AdminReviewDesk({ listings, initialSelectedId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { view, updateView, resetView } = useAdminReviewView();
  const [items, setItems] = useState<AdminReviewListItem[]>(listings);
  console.log("[AdminReviewDesk] listings.length", listings.length);

  const defaultFilters: AdminReviewFilters = useMemo(
    () => ({
      search: "",
      hasVideo: null,
      needsLocation: false,
      needsPhotos: false,
      sort: "oldest",
    }),
    []
  );
  const [filters, setFilters] = useState<AdminReviewFilters>(defaultFilters);
  const selectedId = parseSelectedId(searchParams ?? {}) ?? initialSelectedId;

  const buildUrlWithId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams?.toString());
      if (id) {
        params.set("id", id);
      } else {
        params.delete("id");
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handleSelect = useCallback(
    (id: string) => {
      router.push(buildUrlWithId(id));
    },
    [buildUrlWithId, router]
  );

  const handleClose = useCallback(() => {
    router.push(buildUrlWithId(null));
  }, [buildUrlWithId, router]);

  const handleActionComplete = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        router.push(buildUrlWithId(null));
      }
    },
    [buildUrlWithId, router, selectedId]
  );

  const visibleItems = useMemo(
    () => {
      if (view === "pending") {
        return items;
      }
      return filterAndSortListings(items, view, filters);
    },
    [filters, items, view]
  );

  const selectedListing = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );
  const selectedVisible = !!visibleItems.find((i) => i.id === selectedId);

  // Auto-select first item to keep drawer functional when arriving without id
  const firstId = items[0]?.id || null;
  useEffect(() => {
    if (!selectedId && firstId) {
      router.replace(buildUrlWithId(firstId));
    }
  }, [selectedId, firstId, buildUrlWithId, router]);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.savedViews}</p>
              <p className="text-xs text-slate-600">Showing {visibleItems.length}</p>
            </div>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800"
              onClick={resetView}
            >
              {ADMIN_REVIEW_COPY.views.reset}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "pending", label: ADMIN_REVIEW_COPY.views.pending },
              { key: "changes", label: ADMIN_REVIEW_COPY.views.changes },
              { key: "approved", label: ADMIN_REVIEW_COPY.views.approved },
              { key: "all", label: ADMIN_REVIEW_COPY.views.all },
            ] as const).map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => updateView(v.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  view === v.key
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={ADMIN_REVIEW_COPY.searchPlaceholder}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-64"
            />
            <label className="flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={filters.hasVideo === true}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, hasVideo: e.target.checked ? true : null }))
                }
              />
              {ADMIN_REVIEW_COPY.filters.hasVideo}
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={filters.needsLocation}
                onChange={(e) => setFilters((prev) => ({ ...prev, needsLocation: e.target.checked }))}
              />
              {ADMIN_REVIEW_COPY.filters.needsLocation}
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={filters.needsPhotos}
                onChange={(e) => setFilters((prev) => ({ ...prev, needsPhotos: e.target.checked }))}
              />
              {ADMIN_REVIEW_COPY.filters.needsPhotos}
            </label>
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sort: e.target.value === "newest" ? "newest" : "oldest",
                }))
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            >
              <option value="oldest">{ADMIN_REVIEW_COPY.sort.oldest}</option>
              <option value="newest">{ADMIN_REVIEW_COPY.sort.newest}</option>
            </select>
          </div>
        </div>
        <AdminReviewList listings={visibleItems} onSelect={handleSelect} selectedId={selectedId} />
        {(view === "pending" ? items.length === 0 : visibleItems.length === 0) && (
          <div className="p-6 text-center text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.emptyTitle}</p>
            <p className="text-slate-600">{ADMIN_REVIEW_COPY.list.emptyBody}</p>
          </div>
        )}
      </div>

      <AdminReviewDrawer
        listing={selectedListing}
        onClose={handleClose}
        locationLine={selectedListing ? formatLocationLine(selectedListing) : ""}
        onActionComplete={handleActionComplete}
        isHiddenByFilters={!!selectedId && !selectedVisible}
        onShowHidden={() => {
          setFilters(defaultFilters);
          if (selectedListing?.status === "changes_requested") {
            updateView("changes");
          } else if (selectedListing?.status === "live" || selectedListing?.status === "approved") {
            updateView("approved");
          } else if (selectedListing) {
            updateView("pending");
          }
        }}
        filteredIds={visibleItems.map((i) => i.id)}
        onNavigate={(id) => handleSelect(id)}
        hasListings={items.length > 0}
      />
    </div>
  );
}
