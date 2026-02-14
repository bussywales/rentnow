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
import { ListingPaywallModal } from "@/components/billing/ListingPaywallModal";
import { HostFeaturedRequestModal } from "@/components/host/HostFeaturedRequestModal";
import { HostPaymentsPanel } from "@/components/host/HostPaymentsPanel";
import { HostShortletBookingsPanel } from "@/components/host/HostShortletBookingsPanel";
import { HostShortletEarningsPanel } from "@/components/host/HostShortletEarningsPanel";
import { isPausedStatus, mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import type { PropertyStatus } from "@/lib/types";
import type { MissedDemandEstimate } from "@/lib/analytics/property-events";
import type {
  HostShortletBookingSummary,
  HostShortletEarningSummary,
} from "@/lib/shortlet/shortlet.server";
import { resolveFeaturedRequestHostSummary } from "@/lib/featured/requests";
import {
  formatFeaturedMinorAmount,
  getFeaturedEligibility,
  getFeaturedPricing,
  type FeaturedEligibilityCode,
  type FeaturedEligibilitySettings,
} from "@/lib/featured/eligibility";

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

type FeaturedRequestState = {
  id: string;
  property_id: string;
  duration_days: 7 | 30 | null;
  requested_until: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
};

type FeaturedFixItem = {
  code: FeaturedEligibilityCode;
  label: string;
  href?: string;
  actionLabel?: string;
};

function featuredRequestChipClass(status: FeaturedRequestState["status"] | "featured_active"): string {
  if (status === "featured_active") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function buildFeaturedFixItems(propertyId: string, codes: FeaturedEligibilityCode[]): FeaturedFixItem[] {
  const items: FeaturedFixItem[] = [];
  for (const code of codes) {
    if (code === "requires_approved_listing") {
      items.push({
        code,
        label: "Submit for approval.",
        href: `/dashboard/properties/${propertyId}?step=submit`,
        actionLabel: "Submit now",
      });
      continue;
    }
    if (code === "requires_active_listing") {
      items.push({
        code,
        label: "Activate or relaunch the listing.",
        href: `/dashboard/properties/${propertyId}`,
        actionLabel: "Open listing",
      });
      continue;
    }
    if (code === "min_photos") {
      items.push({
        code,
        label: "Add more listing photos.",
        href: `/dashboard/properties/${propertyId}?step=photos`,
        actionLabel: "Add photos",
      });
      continue;
    }
    if (code === "min_description_chars") {
      items.push({
        code,
        label: "Improve the listing description.",
        href: `/dashboard/properties/${propertyId}`,
        actionLabel: "Edit description",
      });
      continue;
    }
    if (code === "requires_not_demo") {
      items.push({
        code,
        label: "Demo listings are excluded from Featured requests.",
      });
    }
  }
  return items;
}

export function HostDashboardContent({
  listings,
  trustMarkers,
  listingLimitReached,
  hostUserId,
  initialFeaturedRequestsByProperty = {},
  featuredRequestSettings,
  performanceById = {},
  shortletBookings = [],
  shortletEarnings = [],
}: {
  listings: DashboardListing[];
  trustMarkers: TrustMarkerState | null;
  listingLimitReached: boolean;
  hostUserId?: string | null;
  initialFeaturedRequestsByProperty?: Record<string, FeaturedRequestState>;
  featuredRequestSettings: FeaturedEligibilitySettings;
  performanceById?: Record<string, ListingPerformance>;
  shortletBookings?: HostShortletBookingSummary[];
  shortletEarnings?: HostShortletEarningSummary[];
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
  const [featurePending, setFeaturePending] = useState<Record<string, boolean>>({});
  const [featureErrors, setFeatureErrors] = useState<Record<string, string | null>>({});
  const [featurePaywallOpen, setFeaturePaywallOpen] = useState(false);
  const [featurePaywallAmount, setFeaturePaywallAmount] = useState<number | null>(null);
  const [featurePaywallCurrency, setFeaturePaywallCurrency] = useState("NGN");
  const [featurePaywallListing, setFeaturePaywallListing] = useState<DashboardListing | null>(null);
  const [featurePaywallLoading, setFeaturePaywallLoading] = useState(false);
  const [featurePaywallError, setFeaturePaywallError] = useState<string | null>(null);
  const [featuredRequestsByProperty, setFeaturedRequestsByProperty] = useState<
    Record<string, FeaturedRequestState>
  >(initialFeaturedRequestsByProperty);
  const [featuredRequestTarget, setFeaturedRequestTarget] = useState<DashboardListing | null>(null);
  const [featuredRequestSaving, setFeaturedRequestSaving] = useState(false);
  const [featuredPaymentLoading, setFeaturedPaymentLoading] = useState(false);
  const [featuredRequestToast, setFeaturedRequestToast] = useState<string | null>(null);
  const [featuredRequestErrors, setFeaturedRequestErrors] = useState<Record<string, string | null>>({});
  const [featuredRequestModalError, setFeaturedRequestModalError] = useState<string | null>(null);
  const [featuredPaymentModalError, setFeaturedPaymentModalError] = useState<string | null>(null);
  const [featuredRequestModalKey, setFeaturedRequestModalKey] = useState(0);
  const [expandedFeaturedRequestNotes, setExpandedFeaturedRequestNotes] = useState<Record<string, boolean>>({});
  const [openFixChecklistByProperty, setOpenFixChecklistByProperty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalListings(listings);
  }, [listings]);

  useEffect(() => {
    setFeaturedRequestsByProperty(initialFeaturedRequestsByProperty);
  }, [initialFeaturedRequestsByProperty]);

  const summary = useMemo(() => summarizeListings(localListings), [localListings]);
  const featuredPricing = useMemo(
    () => getFeaturedPricing(featuredRequestSettings),
    [featuredRequestSettings]
  );
  const featuredFromPriceLabel = useMemo(
    () => formatFeaturedMinorAmount(featuredPricing.price7dMinor, featuredPricing.currency),
    [featuredPricing.currency, featuredPricing.price7dMinor]
  );
  const filtered = useMemo(() => filterListings(localListings, view), [view, localListings]);
  const searched = useMemo(() => searchListings(filtered, search), [filtered, search]);
  const sorted = useMemo(() => sortListings(searched), [searched]);
  const viewCopy = HOST_DASHBOARD_VIEWS[view];
  const emptyTitle = "empty" in viewCopy ? viewCopy.empty : "No listings in this view";
  const selectedListings = useMemo(
    () => sorted.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, sorted]
  );
  const featuredPaymentAllowedForTarget = useMemo(() => {
    if (!featuredRequestTarget) return false;
    const request = featuredRequestsByProperty[featuredRequestTarget.id] ?? null;
    if (!request || request.status !== "approved") return false;
    const eligibility = getFeaturedEligibility(
      featuredRequestTarget,
      featuredRequestSettings,
      { hasPendingRequest: false }
    );
    return eligibility.eligible;
  }, [featuredRequestSettings, featuredRequestTarget, featuredRequestsByProperty]);
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

  const updateListingFeaturedState = (listingId: string, featuredUntil: string | null) => {
    setLocalListings((prev) =>
      prev.map((item) =>
        item.id === listingId
          ? {
              ...item,
              is_featured: true,
              featured_until: featuredUntil ?? item.featured_until ?? null,
              featured_at: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const buildIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `feat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const handleFeatureListing = async (listing: DashboardListing) => {
    setFeatureErrors((prev) => ({ ...prev, [listing.id]: null }));
    setFeaturePending((prev) => ({ ...prev, [listing.id]: true }));
    try {
      const res = await fetch(`/api/properties/${listing.id}/feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: buildIdempotencyKey() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data?.reason === "PAYMENT_REQUIRED") {
        setFeaturePaywallAmount(data?.amount ?? null);
        setFeaturePaywallCurrency(data?.currency ?? "NGN");
        setFeaturePaywallListing(listing);
        setFeaturePaywallError(null);
        setFeaturePaywallOpen(true);
        return;
      }
      if (!res.ok) {
        setFeatureErrors((prev) => ({
          ...prev,
          [listing.id]: data?.error || "Unable to feature listing.",
        }));
        return;
      }
      updateListingFeaturedState(listing.id, data?.featured_until ?? null);
    } catch (err) {
      setFeatureErrors((prev) => ({
        ...prev,
        [listing.id]:
          err instanceof Error ? err.message : "Unable to feature listing.",
      }));
    } finally {
      setFeaturePending((prev) => ({ ...prev, [listing.id]: false }));
    }
  };

  const closeFeaturePaywall = () => {
    setFeaturePaywallOpen(false);
    setFeaturePaywallError(null);
    setFeaturePaywallListing(null);
    setFeaturePaywallAmount(null);
  };

  const startFeatureCheckout = async () => {
    if (!featurePaywallListing) return;
    setFeaturePaywallLoading(true);
    setFeaturePaywallError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: featurePaywallListing.id,
          purpose: "featured_listing",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeaturePaywallError(data?.error || "Unable to start checkout.");
        return;
      }
      if (data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setFeaturePaywallError("Checkout link missing.");
    } catch (err) {
      setFeaturePaywallError(
        err instanceof Error ? err.message : "Unable to start checkout."
      );
    } finally {
      setFeaturePaywallLoading(false);
    }
  };

  const openFeaturedRequestModal = (listing: DashboardListing) => {
    setFeaturedRequestModalError(null);
    setFeaturedPaymentModalError(null);
    setFeaturedRequestModalKey((prev) => prev + 1);
    setFeaturedRequestTarget(listing);
  };

  const closeFeaturedRequestModal = () => {
    if (featuredRequestSaving) return;
    setFeaturedRequestTarget(null);
    setFeaturedRequestModalError(null);
    setFeaturedPaymentModalError(null);
  };

  const submitFeaturedRequest = async (payload: { durationDays: 7 | 30 | null; note: string | null }) => {
    if (!featuredRequestTarget) return;
    const listing = featuredRequestTarget;
    setFeaturedRequestSaving(true);
    setFeaturedRequestModalError(null);
    setFeaturedRequestErrors((prev) => ({ ...prev, [listing.id]: null }));
    try {
      const response = await fetch("/api/featured/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: listing.id,
          durationDays: payload.durationDays,
          note: payload.note,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = result?.error || "Unable to submit featured request.";
        setFeaturedRequestModalError(errorMessage);
        setFeaturedRequestErrors((prev) => ({ ...prev, [listing.id]: errorMessage }));
        return;
      }

      const requestRow = result?.request;
      if (requestRow && requestRow.property_id) {
        setFeaturedRequestsByProperty((prev) => ({
          ...prev,
          [requestRow.property_id]: {
            id: String(requestRow.id || ""),
            property_id: String(requestRow.property_id || ""),
            duration_days:
              requestRow.duration_days === 7 || requestRow.duration_days === 30
                ? requestRow.duration_days
                : null,
            requested_until:
              typeof requestRow.requested_until === "string" ? requestRow.requested_until : null,
            note: typeof requestRow.note === "string" ? requestRow.note : null,
            status:
              requestRow.status === "approved" ||
              requestRow.status === "rejected" ||
              requestRow.status === "cancelled"
                ? requestRow.status
                : "pending",
            admin_note:
              typeof requestRow.admin_note === "string" ? requestRow.admin_note : null,
            decided_at:
              typeof requestRow.decided_at === "string" ? requestRow.decided_at : null,
            created_at: typeof requestRow.created_at === "string" ? requestRow.created_at : null,
          },
        }));
      }

      setFeaturedRequestToast(
        result?.pending ? "Request pending." : "Request sent. We'll review shortly."
      );
      window.setTimeout(() => setFeaturedRequestToast(null), 3500);
      setFeaturedRequestTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit featured request.";
      setFeaturedRequestModalError(message);
      setFeaturedRequestErrors((prev) => ({ ...prev, [listing.id]: message }));
    } finally {
      setFeaturedRequestSaving(false);
    }
  };

  const proceedToFeaturedPayment = async (payload: { durationDays: 7 | 30 | null }) => {
    if (!featuredRequestTarget) return;
    const request = featuredRequestsByProperty[featuredRequestTarget.id] ?? null;
    const approvedRequestId = request?.status === "approved" ? request.id : null;
    if (!approvedRequestId) {
      setFeaturedPaymentModalError("Request must be approved before payment.");
      return;
    }
    const durationDays =
      payload.durationDays ?? (request?.duration_days === 30 ? 30 : 7);
    const plan = durationDays === 30 ? "featured_30d" : "featured_7d";

    setFeaturedPaymentLoading(true);
    setFeaturedPaymentModalError(null);

    try {
      const response = await fetch("/api/payments/featured/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: featuredRequestTarget.id,
          plan,
          requestId: approvedRequestId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeaturedPaymentModalError(result?.error || "Unable to start payment.");
        return;
      }
      if (!result?.authorization_url) {
        setFeaturedPaymentModalError("Payment link missing.");
        return;
      }
      window.location.assign(String(result.authorization_url));
    } catch (error) {
      setFeaturedPaymentModalError(
        error instanceof Error ? error.message : "Unable to start payment."
      );
    } finally {
      setFeaturedPaymentLoading(false);
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
            const nowMs = Date.now();
            const featuredUntilMs = property.featured_until
              ? Date.parse(property.featured_until)
              : null;
            const featuredActive =
              !!property.is_featured &&
              (!featuredUntilMs || (Number.isFinite(featuredUntilMs) && featuredUntilMs > nowMs));
            const featuredLabel =
              featuredActive && featuredUntilMs && Number.isFinite(featuredUntilMs)
                ? new Date(featuredUntilMs).toLocaleDateString()
                : null;
            const isFeaturing = featurePending[property.id] ?? false;
            const featureError = featureErrors[property.id] ?? null;
            const isDemo = !!property.is_demo;
            const featuredRequest = featuredRequestsByProperty[property.id] ?? null;
            const featuredRequestPending = featuredRequest?.status === "pending";
            const featuredRequestApproved = featuredRequest?.status === "approved";
            const requestError = featuredRequestErrors[property.id] ?? null;
            const featuredEligibility = getFeaturedEligibility(
              property,
              featuredRequestSettings,
              { hasPendingRequest: featuredRequestPending }
            );
            const requestEligible =
              featuredEligibility.eligible &&
              !featuredRequestApproved &&
              !featuredActive &&
              featuredRequestSettings.requestsEnabled;
            const fixItems = buildFeaturedFixItems(
              property.id,
              featuredEligibility.blocking.map((item) => item.code)
            );
            const showFixChecklist = openFixChecklistByProperty[property.id] ?? false;
            const canShowFixToRequest =
              !requestEligible &&
              !featuredRequestPending &&
              !featuredActive &&
              featuredRequestSettings.requestsEnabled &&
              fixItems.length > 0;
            const featuredStatusSummary = resolveFeaturedRequestHostSummary({
              isFeaturedActive: featuredActive,
              hasFeaturedUntil: !!featuredLabel,
              requestStatus: featuredRequest?.status ?? null,
            });
            const featuredStatusLabel =
              featuredStatusSummary.state === "featured_active"
                ? featuredLabel
                  ? `Featured until ${featuredLabel}`
                  : "Featured"
                : featuredStatusSummary.label;
            const decisionNote = featuredRequest?.admin_note?.trim() || null;
            const noteExpanded = expandedFeaturedRequestNotes[property.id] ?? false;
            const truncatedDecisionNote = decisionNote ? truncateText(decisionNote, 120) : null;

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
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusChipClass(normalizedStatus)}`}
                      data-testid={`listing-status-${property.id}`}
                    >
                      {mapStatusLabel(status)}
                    </span>
                    {featuredActive && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
                        Featured{featuredLabel ? ` · until ${featuredLabel}` : ""}
                      </span>
                    )}
                  </div>
                  {isUpdatingStatus && (
                    <span className="text-[11px] text-slate-500">Updating...</span>
                  )}
                </div>
                {pausedReasonLabel && (
                  <p className="mt-2 text-xs text-slate-500">Paused reason: {pausedReasonLabel}</p>
                )}
                {featuredStatusLabel ? (
                  <div className="mt-2 space-y-1">
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${featuredRequestChipClass(
                        featuredStatusSummary.state === "featured_active"
                          ? "featured_active"
                          : featuredRequest?.status ?? "cancelled"
                      )}`}
                    >
                      {featuredStatusLabel}
                    </div>
                    {featuredStatusSummary.showDecisionNote && decisionNote ? (
                      <div className="text-xs text-slate-600">
                        <span>{noteExpanded ? decisionNote : truncatedDecisionNote}</span>{" "}
                        {decisionNote.length > 120 ? (
                          <button
                            type="button"
                            className="font-semibold text-sky-700 underline underline-offset-2"
                            onClick={() =>
                              setExpandedFeaturedRequestNotes((prev) => ({
                                ...prev,
                                [property.id]: !noteExpanded,
                              }))
                            }
                          >
                            {noteExpanded ? "Hide details" : "See details"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                  {isLive && !featuredActive && !isDemo && !featuredRequestSettings.requestsEnabled && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleFeatureListing(property)}
                      disabled={isFeaturing}
                      data-testid={`listing-feature-${property.id}`}
                    >
                      {isFeaturing ? "Featuring..." : "Feature this listing"}
                    </Button>
                  )}
                  {!featuredActive && !featuredRequestSettings.requestsEnabled ? (
                    <Button size="sm" variant="secondary" disabled title="Featured requests are currently paused.">
                      Featured requests paused
                    </Button>
                  ) : null}
                  {!featuredActive && featuredRequestSettings.requestsEnabled && !featuredRequestApproved ? (
                    featuredRequestPending ? (
                      <>
                        <Button size="sm" variant="secondary" disabled data-testid={`listing-feature-request-pending-${property.id}`}>
                          Request pending
                        </Button>
                        <span className="inline-flex items-center text-[11px] text-slate-500">
                          We usually review within 1-{featuredPricing.slaDays} days.
                        </span>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openFeaturedRequestModal(property)}
                          disabled={!requestEligible}
                          title={requestEligible ? "Request featured placement" : "Not eligible yet"}
                          data-testid={`listing-feature-request-${property.id}`}
                        >
                          Request featured
                        </Button>
                        <span className="inline-flex items-center text-[11px] text-slate-500">
                          From {featuredFromPriceLabel} / 7 days
                        </span>
                      </>
                    )
                  ) : null}
                  {!featuredActive && featuredRequestSettings.requestsEnabled && featuredRequestApproved ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openFeaturedRequestModal(property)}
                      data-testid={`listing-feature-pay-${property.id}`}
                    >
                      Pay to activate
                    </Button>
                  ) : null}
                  {canShowFixToRequest ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={() =>
                        setOpenFixChecklistByProperty((prev) => ({
                          ...prev,
                          [property.id]: !showFixChecklist,
                        }))
                      }
                    >
                      {showFixChecklist ? "Hide checklist" : "Fix to request"}
                    </button>
                  ) : null}
                  {featuredActive && (
                    <Button size="sm" variant="secondary" disabled title="Already featured">
                      Request featured
                    </Button>
                  )}
                  {isLive && isDemo && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      Demo listings can&apos;t be featured
                    </span>
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
                {showFixChecklist && canShowFixToRequest ? (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Request checklist</p>
                    <ul className="mt-2 space-y-2 text-xs text-slate-600">
                      {fixItems.map((item) => (
                        <li key={`${property.id}-${item.code}`} className="flex items-center justify-between gap-2">
                          <span>{item.label}</span>
                          {item.href ? (
                            <Link href={item.href} className="font-semibold text-sky-700 underline underline-offset-2">
                              {item.actionLabel || "Open"}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {statusError && <p className="mt-2 text-xs text-rose-600">{statusError}</p>}
                {featureError && <p className="mt-2 text-xs text-rose-600">{featureError}</p>}
                {requestError && <p className="mt-2 text-xs text-rose-600">{requestError}</p>}
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
      <HostShortletBookingsPanel initialRows={shortletBookings} />
      <HostShortletEarningsPanel rows={shortletEarnings} />
      <HostPaymentsPanel />
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
      <ListingPaywallModal
        open={featurePaywallOpen && featurePaywallAmount !== null}
        amount={featurePaywallAmount ?? 0}
        currency={featurePaywallCurrency}
        onClose={closeFeaturePaywall}
        onPay={startFeatureCheckout}
        onPlans={() => {
          window.location.assign("/dashboard/billing");
        }}
        loading={featurePaywallLoading}
        error={featurePaywallError}
        mode="featured"
      />
      <HostFeaturedRequestModal
        key={`${featuredRequestTarget?.id ?? "none"}-${featuredRequestModalKey}`}
        open={!!featuredRequestTarget}
        listingTitle={featuredRequestTarget?.title}
        submitting={featuredRequestSaving}
        paymentLoading={featuredPaymentLoading}
        error={featuredRequestModalError}
        paymentError={featuredPaymentModalError}
        requestsEnabled={featuredRequestSettings.requestsEnabled}
        currency={featuredPricing.currency}
        price7dMinor={featuredPricing.price7dMinor}
        price30dMinor={featuredPricing.price30dMinor}
        reviewSlaDays={featuredPricing.slaDays}
        canProceedToPayment={
          featuredRequestSettings.requestsEnabled &&
          !featuredPaymentLoading &&
          featuredPaymentAllowedForTarget
        }
        defaultDurationDays={
          featuredRequestTarget
            ? featuredRequestsByProperty[featuredRequestTarget.id]?.duration_days ?? 7
            : 7
        }
        defaultNote={
          featuredRequestTarget
            ? featuredRequestsByProperty[featuredRequestTarget.id]?.note ?? null
            : null
        }
        onClose={closeFeaturedRequestModal}
        onSubmit={submitFeaturedRequest}
        onProceedToPayment={proceedToFeaturedPayment}
      />
      {featuredRequestToast ? (
        <div className="fixed bottom-4 inset-x-4 z-40 w-auto sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm">
          <Alert title="Featured request" description={featuredRequestToast} variant="success" />
        </div>
      ) : null}
      {popupBlockedCount !== null && (
        <div className="fixed bottom-24 inset-x-4 z-40 w-auto sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm">
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
