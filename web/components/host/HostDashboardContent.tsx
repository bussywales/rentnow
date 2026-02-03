"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildEditorLink, exportListingsCsv, openListings } from "@/lib/host/bulk-triage";
import { Alert } from "@/components/ui/Alert";
import { RenewListingButton } from "@/components/host/RenewListingButton";
import { ListingPauseModal } from "@/components/host/ListingPauseModal";
import { ListingReactivateModal } from "@/components/host/ListingReactivateModal";
import { isPausedStatus, mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import type { PropertyStatus } from "@/lib/types";
import type { MissedDemandEstimate } from "@/lib/analytics/property-events";

function normalizeStatus(property: {
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  expires_at?: string | null;
}) {
  const normalized = property.status ? property.status.toString().trim().toLowerCase() : null;
  if (normalized === "live" && property.expires_at) {
    const expiresMs = Date.parse(property.expires_at);
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) return "expired";
  }
  if (property.status) return property.status as typeof property.status;
  if (property.is_approved && property.is_active) return "live";
  if (!property.is_approved && property.is_active) return "pending";
  return "draft";
}

type StatusResponse = {
  status?: PropertyStatus | null;
  paused_at?: string | null;
  reactivated_at?: string | null;
  status_updated_at?: string | null;
  paused_reason?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  expires_at?: string | null;
  error?: string;
};

type StatusUpdatePayload = {
  status: "live" | "paused_owner" | "paused_occupied";
  paused_reason?: string | null;
};

type ListingPerformance = {
  views: number;
  saves: number;
  leads: number;
  missedDemand?: MissedDemandEstimate | null;
};

export function HostDashboardContent({
  listings,
  trustMarkers,
  listingLimitReached,
  hostUserId,
  performanceById = {},
}: {
  listings: DashboardListing[];
  trustMarkers: TrustMarkerState | null;
  listingLimitReached: boolean;
  hostUserId?: string | null;
  performanceById?: Record<string, ListingPerformance>;
}) {
  const [search, setSearch] = useState("");
  const { view, setView } = useHostDashboardView(hostUserId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [popupBlockedCount, setPopupBlockedCount] = useState<number | null>(null);
  const [localListings, setLocalListings] = useState(listings);
  const [pauseTarget, setPauseTarget] = useState<DashboardListing | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<DashboardListing | null>(null);
  const [statusPending, setStatusPending] = useState<Record<string, boolean>>({});
  const [statusErrors, setStatusErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setLocalListings(listings);
  }, [listings]);

  const summary = useMemo(() => summarizeListings(localListings), [localListings]);
  const filtered = useMemo(() => filterListings(localListings, view), [view, localListings]);
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
    const { blocked } = openListings(urls);
    if (blocked > 0) {
      setPopupBlockedCount(blocked);
      window.setTimeout(() => setPopupBlockedCount(null), 4500);
    } else {
      setPopupBlockedCount(null);
    }
  };

  const handleExport = () => {
    if (!selectedListings.length) return;
    exportListingsCsv(selectedListings);
  };

  const handleViewChange = (nextView: typeof view) => {
    clearSelection();
    setView(nextView);
  };

  const statusChipClass = (value: string | null) => {
    const normalized = normalizePropertyStatus(value);
    switch (normalized) {
      case "live":
        return "bg-emerald-100 text-emerald-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "draft":
        return "bg-slate-100 text-slate-600";
      case "rejected":
        return "bg-rose-100 text-rose-700";
      case "expired":
        return "bg-amber-100 text-amber-700";
      case "paused":
      case "paused_owner":
      case "paused_occupied":
        return "bg-slate-200 text-slate-700";
      case "changes_requested":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const formatPausedReason = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    if (normalized === "owner_hold") return "Owner hold";
    if (normalized === "occupied") return "Tenant moved in";
    return value;
  };

  const formatMissedDemand = (estimate?: MissedDemandEstimate | null) => {
    if (!estimate || estimate.state === "not_applicable") return null;
    if (estimate.state === "no_history") return "Missed demand: no live history yet.";
    if (estimate.state === "not_enough_data") return "Missed demand: not enough data yet.";
    return `Missed demand est. ${estimate.missed}`;
  };

  const openPauseModal = (listing: DashboardListing) => {
    setStatusErrors((prev) => ({ ...prev, [listing.id]: null }));
    setPauseTarget(listing);
  };

  const openReactivateModal = (listing: DashboardListing) => {
    setStatusErrors((prev) => ({ ...prev, [listing.id]: null }));
    setReactivateTarget(listing);
  };

  const mergeValue = <T,>(value: T | null | undefined, fallback: T): T =>
    value === null || typeof value === "undefined" ? fallback : value;

  const applyStatusResponse = (
    listing: DashboardListing,
    payload: StatusResponse
  ): DashboardListing => {
    const nowIso = new Date().toISOString();
    return {
      ...listing,
      status: mergeValue(payload.status, listing.status),
      paused_at: mergeValue(payload.paused_at, listing.paused_at ?? null),
      reactivated_at: mergeValue(payload.reactivated_at, listing.reactivated_at ?? null),
      status_updated_at: mergeValue(payload.status_updated_at, listing.status_updated_at ?? null),
      paused_reason: mergeValue(payload.paused_reason, listing.paused_reason ?? null),
      is_active: mergeValue(payload.is_active, listing.is_active ?? false),
      is_approved: mergeValue(payload.is_approved, listing.is_approved ?? false),
      expires_at: mergeValue(payload.expires_at, listing.expires_at ?? null),
      updated_at: nowIso,
    };
  };

  const submitStatusChange = async (
    listing: DashboardListing,
    payload: StatusUpdatePayload
  ) => {
    const listingId = listing.id;
    const previousListings = localListings;
    const nowIso = new Date().toISOString();
    const optimisticPatch: Partial<DashboardListing> =
      payload.status === "live"
        ? {
            status: "live" as PropertyStatus,
            is_active: true,
            is_approved: true,
            reactivated_at: nowIso,
            status_updated_at: nowIso,
          }
        : {
            status: payload.status as PropertyStatus,
            is_active: false,
            paused_at: nowIso,
            paused_reason: payload.paused_reason ?? null,
            status_updated_at: nowIso,
          };

    setLocalListings((prev) =>
      prev.map((item) => (item.id === listingId ? { ...item, ...optimisticPatch } : item))
    );
    setStatusPending((prev) => ({ ...prev, [listingId]: true }));
    setStatusErrors((prev) => ({ ...prev, [listingId]: null }));

    try {
      const res = await fetch(`/api/listings/${listingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as StatusResponse;
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setLocalListings((prev) =>
        prev.map((item) => (item.id === listingId ? applyStatusResponse(item, data) : item))
      );
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update listing status";
      setLocalListings(previousListings);
      setStatusErrors((prev) => ({ ...prev, [listingId]: message }));
      return { ok: false as const, error: message };
    } finally {
      setStatusPending((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const handlePauseConfirm = async (payload: {
    status: "paused_owner" | "paused_occupied";
    paused_reason: string;
  }) => {
    if (!pauseTarget) return;
    const result = await submitStatusChange(pauseTarget, payload);
    if (result.ok) setPauseTarget(null);
  };

  const handleReactivateConfirm = async () => {
    if (!reactivateTarget) return;
    const result = await submitStatusChange(reactivateTarget, { status: "live" });
    if (result.ok) setReactivateTarget(null);
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
            const normalizedStatus = normalizePropertyStatus(status) ?? status;
            const readiness = property.readiness;
            const topIssueCode = readiness.issues[0]?.code;
            const improveHref = buildEditorUrl(property.id, topIssueCode);
            const isExpired = status === "expired";
            const isPaused = isPausedStatus(normalizedStatus);
            const isLive = normalizedStatus === "live";
            const hasPhotos = (property.images || []).length > 0;
            const needsResume =
              readiness.tier !== "Excellent" || readiness.score < 90 || readiness.issues.length > 0;
            const canSubmit = ["draft", "rejected", "changes_requested"].includes(
              normalizedStatus ?? ""
            );
            const pausedReasonLabel = isPaused ? formatPausedReason(property.paused_reason) : null;
            const isUpdatingStatus = statusPending[property.id] ?? false;
            const statusError = statusErrors[property.id] ?? null;
            const performance = performanceById[property.id];
            const missedDemandLabel = formatMissedDemand(performance?.missedDemand);

            return (
              <div
                key={property.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                data-testid={`host-listing-card-${property.id}`}
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
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusChipClass(normalizedStatus)}`}
                    data-testid={`listing-status-${property.id}`}
                  >
                    {mapStatusLabel(status)}
                  </span>
                  {isUpdatingStatus && (
                    <span className="text-[11px] text-slate-500">Updating...</span>
                  )}
                </div>
                {pausedReasonLabel && (
                  <p className="mt-2 text-xs text-slate-500">Paused reason: {pausedReasonLabel}</p>
                )}
                <div className="mt-3">
                  <PropertyCard
                    property={property}
                    compact
                    href={`/dashboard/properties/${property.id}`}
                    trustMarkers={trustMarkers}
                    trustVariant="admin"
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
                {performance && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <div className="font-semibold text-slate-700">Demand last 7d</div>
                    <div className="mt-1 text-[11px] text-slate-600">
                      Views {performance.views} · Saves {performance.saves} · Leads {performance.leads}
                    </div>
                    {(isPaused || isExpired) && missedDemandLabel && (
                      <div className="mt-1 text-[11px] text-slate-500">{missedDemandLabel}</div>
                    )}
                  </div>
                )}
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
                  {isExpired && (
                    <RenewListingButton propertyId={property.id} size="sm" />
                  )}
                  {isLive && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openPauseModal(property)}
                      disabled={isUpdatingStatus}
                      data-testid={`listing-pause-${property.id}`}
                    >
                      {isUpdatingStatus ? "Pausing..." : "Pause"}
                    </Button>
                  )}
                  {isPaused && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openReactivateModal(property)}
                      disabled={isUpdatingStatus}
                      data-testid={`listing-reactivate-${property.id}`}
                    >
                      {isUpdatingStatus ? "Reactivating..." : "Reactivate"}
                    </Button>
                  )}
                  {canSubmit ? (
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
                {statusError && <p className="mt-2 text-xs text-rose-600">{statusError}</p>}
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
      <ListingPauseModal
        key={pauseTarget?.id ?? "pause-closed"}
        open={!!pauseTarget}
        listingTitle={pauseTarget?.title}
        onClose={() => setPauseTarget(null)}
        onConfirm={handlePauseConfirm}
        submitting={pauseTarget ? statusPending[pauseTarget.id] ?? false : false}
        error={pauseTarget ? statusErrors[pauseTarget.id] ?? null : null}
      />
      <ListingReactivateModal
        open={!!reactivateTarget}
        listingTitle={reactivateTarget?.title}
        onClose={() => setReactivateTarget(null)}
        onConfirm={handleReactivateConfirm}
        submitting={reactivateTarget ? statusPending[reactivateTarget.id] ?? false : false}
        error={reactivateTarget ? statusErrors[reactivateTarget.id] ?? null : null}
      />
      {popupBlockedCount !== null && (
        <div className="fixed bottom-24 right-4 z-40 max-w-sm">
          <Alert
            title="Pop-ups blocked"
            description={`Your browser blocked ${popupBlockedCount} tab(s). Allow pop-ups for propatyhub.com to open multiple listings.`}
            variant="warning"
            onClose={() => setPopupBlockedCount(null)}
          />
        </div>
      )}
    </div>
  );
}
