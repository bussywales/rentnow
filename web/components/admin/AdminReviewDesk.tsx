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
import AdminSavedViews from "./AdminSavedViews";
import { AdminReviewList } from "./AdminReviewList";
import { useAdminReviewView, type AdminReviewView } from "@/lib/admin/admin-review-view";
import { DrawerErrorBoundary } from "./AdminReviewShell";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
  allowedViews?: AdminReviewView[];
  viewLabels?: Partial<Record<AdminReviewView, string>>;
  showBulkSelect?: boolean;
  bulkFormId?: string;
  actionsEnabled?: boolean;
};

const DEFAULT_ALLOWED_VIEWS: AdminReviewView[] = ["pending", "changes", "approved", "all"];

export function AdminReviewDesk({
  listings,
  initialSelectedId,
  allowedViews = DEFAULT_ALLOWED_VIEWS,
  viewLabels,
  showBulkSelect = false,
  bulkFormId = "bulk-approvals",
  actionsEnabled = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { view, updateView, resetView } = useAdminReviewView();
  const [items, setItems] = useState<AdminReviewListItem[]>(listings);
  console.log("[AdminReviewDesk] listings.length", listings.length);
  const allowed = allowedViews.length ? allowedViews : DEFAULT_ALLOWED_VIEWS;
  const effectiveView = allowed.includes(view) ? view : allowed[0];

  useEffect(() => {
    setItems(listings);
  }, [listings]);

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
      params.delete("id");
      if (id) params.set("id", id);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handleSelect = useCallback(
    (id: string) => {
      console.log("[AdminReviewDesk] select click", { id, pathname, view });
      router.replace(buildUrlWithId(id), { scroll: false });
    },
    [buildUrlWithId, router, pathname, view]
  );

  const handleClose = useCallback(() => {
    router.push(buildUrlWithId(null), { scroll: false });
  }, [buildUrlWithId, router]);

  const visibleItems = useMemo(
    () => {
      return filterAndSortListings(items, effectiveView, filters);
    },
    [filters, items, effectiveView]
  );

  const handleActionComplete = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        const remaining = visibleItems.filter((item) => item.id !== id);
        const currentIndex = visibleItems.findIndex((item) => item.id === id);
        const nextId =
          remaining[currentIndex] ? remaining[currentIndex].id : remaining[currentIndex - 1]?.id ?? remaining[0]?.id ?? null;
        router.push(buildUrlWithId(nextId), { scroll: false });
      }
      router.refresh();
    },
    [buildUrlWithId, router, selectedId, visibleItems]
  );

  const selectedListing = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );
  const selectedVisible = !!visibleItems.find((i) => i.id === selectedId);

  // Auto-select first item to keep drawer functional when arriving without id
  const firstId = visibleItems[0]?.id || null;
  useEffect(() => {
    if (!selectedId && firstId) {
      console.log("[AdminReviewDesk] auto-select first", { firstId });
      router.replace(buildUrlWithId(firstId), { scroll: false });
    }
  }, [selectedId, firstId, buildUrlWithId, router]);

  useEffect(() => {
    if (!allowed.includes(view)) {
      updateView(allowed[0]);
    }
  }, [allowed, updateView, view]);

  return (
    <div
      className="flex h-[calc(100vh-140px)] flex-col gap-4 overflow-hidden lg:flex-row"
      data-admin-review-layout="split"
    >
      <aside
        className="w-full flex-shrink-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:max-w-[420px]"
        data-admin-review-pane="left"
      >
        <div className="border-b border-slate-200 px-4 py-4 space-y-3">
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
          <AdminSavedViews route="/admin/review" />
          <div className="flex flex-wrap gap-2">
            {(allowed as AdminReviewView[]).map((key) => {
              const fallbackLabel = ADMIN_REVIEW_COPY.views[key];
              const label =
                viewLabels?.[key] ??
                (key === "all" && allowed.length <= 3 ? "All reviewable" : fallbackLabel);
              return (
              <button
                key={key}
                type="button"
                onClick={() => updateView(key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  effectiveView === key
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
              );
            })}
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
        <AdminReviewList
          listings={visibleItems}
          onSelect={handleSelect}
          selectedId={selectedId}
          showBulkSelect={showBulkSelect}
          bulkFormId={bulkFormId}
        />
        {(effectiveView === "pending" ? items.length === 0 : visibleItems.length === 0) && (
          <div className="p-6 text-center text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.emptyTitle}</p>
            <p className="text-slate-600">{ADMIN_REVIEW_COPY.list.emptyBody}</p>
          </div>
        )}
      </aside>

      <section
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        data-admin-review-pane="right"
      >
        <DrawerErrorBoundary selectedId={selectedListing?.id ?? null}>
          <AdminReviewDrawer
            listing={selectedListing}
            onClose={handleClose}
            locationLine={selectedListing ? formatLocationLine(selectedListing) : ""}
            onActionComplete={handleActionComplete}
            isHiddenByFilters={!!selectedId && !selectedVisible}
            onShowHidden={() => {
              setFilters(defaultFilters);
              let nextView: AdminReviewView | null = null;
              if (selectedListing?.reviewStage === "changes") {
                nextView = "changes";
              } else if (selectedListing?.status === "live" || selectedListing?.status === "approved") {
                nextView = "approved";
              } else if (selectedListing) {
                nextView = "pending";
              }
              if (nextView && allowed.includes(nextView)) {
                updateView(nextView);
              } else if (selectedListing && allowed.length) {
                updateView(allowed[0]);
              }
            }}
            filteredIds={visibleItems.map((i) => i.id)}
            onNavigate={(id) => handleSelect(id)}
            hasListings={items.length > 0}
            actionsEnabled={actionsEnabled}
          />
        </DrawerErrorBoundary>
      </section>
    </div>
  );
}
