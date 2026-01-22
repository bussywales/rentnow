"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PropertyCard } from "@/components/properties/PropertyCard";
import type { TrustMarkerState } from "@/lib/trust-markers";
import {
  filterListings,
  searchListings,
  sortListings,
  summarizeListings,
  type DashboardListing,
} from "@/lib/properties/host-dashboard";
import { ListingReadinessBadge } from "@/components/host/ListingReadinessBadge";
import { ListingQuickFixes } from "@/components/host/ListingQuickFixes";
import { HostDashboardControls } from "@/components/host/HostDashboardControls";
import { HostDashboardSavedViews } from "@/components/host/HostDashboardSavedViews";
import { HOST_DASHBOARD_COPY, HOST_DASHBOARD_VIEWS } from "@/lib/host/host-dashboard-microcopy";
import { useHostDashboardView } from "@/components/host/useHostDashboardView";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { buildEditorUrl, getLastUpdatedDate } from "@/lib/properties/host-dashboard";
import { ListingBulkActionsBar } from "@/components/host/ListingBulkActionsBar";
import { HostBulkResumeSetupModal } from "@/components/host/HostBulkResumeSetupModal";
import { buildEditorLink, exportListingsCsv } from "@/lib/host/bulk-triage";

function normalizeStatus(property: { status?: string | null; is_active?: boolean | null; is_approved?: boolean | null }) {
  if (property.status) return property.status as typeof property.status;
  if (property.is_approved && property.is_active) return "live";
  if (!property.is_approved && property.is_active) return "pending";
  return "draft";
}

export function HostDashboardContent({
  listings,
  trustMarkers,
  listingLimitReached,
  hostUserId,
}: {
  listings: DashboardListing[];
  trustMarkers: TrustMarkerState | null;
  listingLimitReached: boolean;
  hostUserId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const { view, setView } = useHostDashboardView(hostUserId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showResumeModal, setShowResumeModal] = useState(false);

  const summary = useMemo(() => summarizeListings(listings), [listings]);
  const filtered = useMemo(() => filterListings(listings, view), [view, listings]);
  const searched = useMemo(() => searchListings(filtered, search), [filtered, search]);
  const sorted = useMemo(() => sortListings(searched), [searched]);
  const viewCopy = HOST_DASHBOARD_VIEWS[view];
  const emptyTitle = "empty" in viewCopy ? viewCopy.empty : "No listings in this view";
  const selectedListings = useMemo(
    () => sorted.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, sorted]
  );
  const allSelected = sorted.length > 0 && selectedIds.length === sorted.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sorted.map((item) => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const openUpToFive = () => {
    const urls = selectedListings.slice(0, 5).map((listing) => buildEditorLink(listing));
    urls.forEach((url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const handleExport = () => {
    if (!selectedListings.length) return;
    exportListingsCsv(selectedListings);
  };

  const handleViewChange = (nextView: typeof view) => {
    clearSelection();
    setView(nextView);
  };

  return (
    <div className="space-y-3">
      <HostDashboardSavedViews
        view={view}
        onSelect={handleViewChange}
        onReset={() => handleViewChange("all")}
      />
      <HostDashboardControls
        search={search}
        onSearch={setSearch}
        summary={summary}
        showing={sorted.length}
        selectAllChecked={allSelected}
        onToggleSelectAll={toggleSelectAll}
      />
      {sorted.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((property) => {
          const status = normalizeStatus(property);
          const readiness = property.readiness;
          const topIssueCode = readiness.issues[0]?.code;
          const improveHref = buildEditorUrl(property.id, topIssueCode);
            const hasPhotos = (property.images || []).length > 0;
            const needsResume =
              readiness.tier !== "Excellent" || readiness.score < 90 || readiness.issues.length > 0;

            return (
              <div
                key={property.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={selectedIds.includes(property.id)}
                      onChange={() => toggleSelect(property.id)}
                    />
                    <span>Select</span>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {status}
                  </span>
                  {status === "draft" && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Continue draft
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <PropertyCard
                    property={property}
                    compact
                    href={`/dashboard/properties/${property.id}`}
                    trustMarkers={trustMarkers}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>Readiness</span>
                  <span className="font-semibold text-slate-900">
                    {readiness.score} · {readiness.tier}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {HOST_DASHBOARD_COPY.lastUpdatedLabel}:{" "}
                  {formatRelativeTime(getLastUpdatedDate(property))}
                </div>
                <div className="mt-2">
                  <ListingReadinessBadge readiness={readiness} improveHref={improveHref} />
                </div>
                {needsResume && (
                  <div className="mt-2">
                    <Link href={improveHref}>
                      <Button size="sm" className="w-full sm:w-auto">
                        Resume setup
                      </Button>
                    </Link>
                  </div>
                )}
                {readiness.issues.length > 0 && readiness.tier !== "Excellent" && (
                  <ListingQuickFixes readiness={readiness} propertyId={property.id} />
                )}
                {property.rejection_reason && status === "rejected" && (
                  <p className="mt-2 text-xs text-rose-600">
                    Rejection reason: {property.rejection_reason}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/dashboard/properties/${property.id}`}>
                    <Button size="sm" variant="secondary">
                      Edit listing
                    </Button>
                  </Link>
                  {!hasPhotos && (
                    <Link href={`/dashboard/properties/${property.id}?step=photos`}>
                      <Button size="sm" variant="secondary">
                        Add photos
                      </Button>
                    </Link>
                  )}
                  {status === "draft" || status === "paused" || status === "rejected" ? (
                    listingLimitReached ? (
                      <Button size="sm" type="button" variant="secondary" disabled>
                        Submit for approval
                      </Button>
                    ) : (
                      <Link href={`/dashboard/properties/${property.id}?step=submit`}>
                        <Button size="sm" type="button">
                          Submit for approval
                        </Button>
                      </Link>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">
            {emptyTitle}
          </p>
          <p className="mt-1 text-sm text-slate-600">{viewCopy.description}</p>
        </div>
      )}
      <ListingBulkActionsBar
        count={selectedIds.length}
        onResume={() => setShowResumeModal(true)}
        onOpenFive={openUpToFive}
        onExport={handleExport}
        onClear={clearSelection}
      />
      <HostBulkResumeSetupModal
        open={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        listings={selectedListings}
      />
    </div>
  );
}
