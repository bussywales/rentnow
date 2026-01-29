"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { z } from "zod";
import { AdminReviewChecklistPanel } from "./AdminReviewChecklistPanel";
import {
  canApproveChecklist,
  type ReviewChecklist,
  getChecklistSummary,
  formatChecklistMissingSections,
  type ChecklistSectionKey,
} from "@/lib/admin/admin-review-checklist";
import {
  REVIEW_REASONS,
  buildRequestChangesMessage,
  normalizeReasons,
  parseRejectionReason,
  validateRequestChangesPayload,
  type ReviewReasonCode,
} from "@/lib/admin/admin-review-rubric";

type Props = {
  listing: AdminReviewListItem | null;
  onClose: () => void;
  locationLine: string;
  onActionComplete: (id: string) => void;
  isHiddenByFilters: boolean;
  onShowHidden: () => void;
  filteredIds: string[];
  onNavigate: (id: string) => void;
  hasListings: boolean;
  actionsEnabled?: boolean;
  canApprove?: boolean;
  approveDisabledReason?: string | null;
};

const detailSchema = z.object({
  listing: z.object({
    id: z.string(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    updated_at: z.string().nullable(),
    submitted_at: z.string().nullable(),
    is_approved: z.boolean().nullable(),
    approved_at: z.string().nullable(),
    rejected_at: z.string().nullable(),
    is_active: z.boolean().nullable(),
    rejection_reason: z.string().nullable(),
    owner_id: z.string().nullable().optional(),
    city: z.string().nullable(),
    state_region: z.string().nullable(),
    country_code: z.string().nullable(),
    location_label: z.string().nullable(),
    location_place_id: z.string().nullable(),
    latitude: z.coerce.number().nullable().optional(),
    longitude: z.coerce.number().nullable().optional(),
    photo_count: z.coerce.number().nullable().optional(),
    has_video: z.boolean().nullable(),
    has_cover: z.boolean().nullable(),
    cover_image_url: z.string().nullable(),
    price: z.coerce.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    rent_period: z.string().nullable().optional(),
    rental_type: z.string().nullable().optional(),
    listing_type: z.string().nullable().optional(),
    bedrooms: z.coerce.number().nullable().optional(),
    bathrooms: z.coerce.number().nullable().optional(),
  }),
  images: z.array(
    z.object({
      id: z.string(),
      image_url: z.string().nullable(),
      width: z.coerce.number().nullable().optional(),
      height: z.coerce.number().nullable().optional(),
    })
  ),
  videos: z.array(
    z.object({
      id: z.string(),
      video_url: z.string().nullable(),
    })
  ),
  activity: z
    .array(
      z.object({
        id: z.string(),
        action_type: z.string(),
        actor_id: z.string().nullable().optional(),
        actor_name: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
        payload_json: z.unknown().optional(),
      })
    )
    .optional(),
});

function ChecklistChip({ status }: { status: "pass" | "needs_fix" | "blocker" | null | undefined }) {
  if (!status) {
    return <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">Not set</span>;
  }
  const tone =
    status === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "blocker"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const label = status === "needs_fix" ? "Needs fix" : status === "blocker" ? "Blocker" : "Pass";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

export function AdminReviewDrawer({
  listing,
  onClose,
  locationLine,
  onActionComplete,
  isHiddenByFilters,
  onShowHidden,
  filteredIds,
  onNavigate,
  hasListings,
  actionsEnabled = true,
  canApprove = true,
  approveDisabledReason,
}: Props) {
  const isOpen = !!listing;
  const [reasons, setReasons] = useState<ReviewReasonCode[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "request" | "reject" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIdSnapshot, setSelectedIdSnapshot] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<z.infer<typeof detailSchema> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<
    { id: string; name: string; reasons?: ReviewReasonCode[]; message?: string }[]
  >([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDeleting, setTemplateDeleting] = useState(false);
  const [checklistState, setChecklistState] = useState<ReviewChecklist | null>(null);
  const approveGuard = useMemo(() => canApproveChecklist(checklistState), [checklistState]);
  const effectiveCanApprove = canApprove ?? approveGuard.ok;
  const approveReason = approveDisabledReason ?? approveGuard.reason;
  const [copiedId, setCopiedId] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<ChecklistSectionKey | null>(null);
  const navIds = filteredIds;
  const currentIndex = useMemo(() => (listing ? navIds.indexOf(listing.id) : -1), [listing, navIds]);
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < navIds.length - 1 ? navIds[currentIndex + 1] : null;

  useEffect(() => {
    if (!listing) {
      setReasons([]);
      setMessageText("");
      setMessageEdited(false);
      setToast(null);
      setSelectedIdSnapshot(null);
      setDetailData(null);
      setDetailError(null);
      setDetailLoading(false);
      setChecklistState(null);
      setChecklistOpen(false);
      setScrollTarget(null);
      return;
    }
    setSelectedIdSnapshot(listing.id);
    setChecklistState(null);
    setChecklistOpen(false);
    setScrollTarget(null);
    const parsed = parseRejectionReason(listing.rejectionReason);
    const normalized = normalizeReasons(parsed.reasons);
    const initialMessage = parsed.message || buildRequestChangesMessage(normalized);
    setReasons(normalized);
    setMessageText(initialMessage);
    setMessageEdited(false);
    setSubmitting(null);
    setToast(null);
  }, [listing]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!listing?.id) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        console.log("[AdminReviewDrawer] fetch detail start", { id: listing.id });
        const res = await fetch(`/api/admin/review/${listing.id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to load details");
        }
        const json = await res.json();
        const parsed = detailSchema.parse(json);
        // Guard against race when selection changes mid-flight
        if (listing.id === selectedIdSnapshot || !selectedIdSnapshot) {
          setDetailData(parsed);
        }
        console.log("[AdminReviewDrawer] fetch detail success", { id: listing.id });
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Failed to load details");
        setDetailData(null);
        console.error("[AdminReviewDrawer] fetch detail error", { id: listing?.id, err });
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail().catch(() => {
      setDetailError("Failed to load details");
      setDetailLoading(false);
    });
  }, [listing?.id, selectedIdSnapshot]);

  const previewMessage = useMemo(() => {
    const trimmed = messageText.trim();
    return trimmed || buildRequestChangesMessage(reasons);
  }, [messageText, reasons]);

  const detail = detailData ?? null;
  const images = detail?.images ?? [];
  const videos = detail?.videos ?? [];
  const activity = detail?.activity ?? [];
  const canReview = listing?.reviewStage === "pending" || listing?.reviewStage === "changes" || listing?.reviewable === true;
  const checklistSummary = useMemo(() => getChecklistSummary(checklistState), [checklistState]);
  const missingLabels = formatChecklistMissingSections(checklistState);

  const toggleReason = (code: ReviewReasonCode) => {
    setReasons((prev) => {
      const next = prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code];
      if (!messageEdited || !messageText.trim()) {
        setMessageText(buildRequestChangesMessage(next));
        setMessageEdited(false);
      }
      return next;
    });
  };

  const handleSendRequest = async () => {
    if (!listing) return;
    const validation = validateRequestChangesPayload(reasons, messageText);
    if (!validation.ok) {
      setToast(validation.error || "Invalid request");
      return;
    }
    setSubmitting("request");
    setToast(null);
    try {
      const res = await fetch(`/api/admin/properties/${listing.id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons, message: validation.message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to send request");
      }
      setToast(ADMIN_REVIEW_COPY.drawer.changesRequestedToast);
      onActionComplete(listing.id);
      setMessageEdited(false);
      setMessageText("");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to send request");
    } finally {
      setSubmitting(null);
    }
  };

  const handleApprove = async () => {
    if (!listing) return;
    setSubmitting("approve");
    setToast(null);
    try {
      const res = await fetch(`/api/admin/properties/${listing.id}/approve`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to approve");
      }
      setToast("Listing approved.");
      onActionComplete(listing.id);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to approve");
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!listing) return;
    const reason = messageText.trim();
    if (!reason) {
      setToast("Rejection reason is required");
      return;
    }
    setSubmitting("reject");
    setToast(null);
    try {
      const res = await fetch(`/api/admin/properties/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to reject");
      }
      setToast("Listing rejected.");
      onActionComplete(listing.id);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to reject");
    } finally {
      setSubmitting(null);
    }
  };

  useEffect(() => {
    if (!listing) return;
    const isEditableTarget = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    };
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "j" && nextId) {
        event.preventDefault();
        onNavigate(nextId);
        return;
      }
      if (key === "k" && prevId) {
        event.preventDefault();
        onNavigate(prevId);
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!actionsEnabled) return;
      if (key === "a" && canApprove && submitting === null) {
        event.preventDefault();
        handleApprove();
        return;
      }
      if (key === "c" && submitting === null) {
        event.preventDefault();
        handleSendRequest();
        return;
      }
      if (key === "r" && submitting === null) {
        event.preventDefault();
        handleReject();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    listing,
    nextId,
    prevId,
    onNavigate,
    onClose,
    actionsEnabled,
    canApprove,
    submitting,
    handleApprove,
    handleSendRequest,
    handleReject,
  ]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/admin/review/templates");
        if (!res.ok) return;
        const json = await res.json();
        const templatesData = Array.isArray(json?.templates) ? json.templates : [];
        setTemplates(templatesData);
      } catch {
        /* ignore */
      }
    };
    fetchTemplates().catch(() => undefined);
  }, []);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const templateReasons = normalizeReasons(template.reasons ?? []);
    setReasons(templateReasons);
    setMessageText(template.message || buildRequestChangesMessage(templateReasons));
    setMessageEdited(true);
    setSelectedTemplateId(templateId);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      setToast("Template name is required");
      return;
    }
    try {
      const res = await fetch("/api/admin/review/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), reasons, message: messageText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to save template");
      }
      const json = await res.json();
      setTemplates((prev) => [json.template, ...prev]);
      setTemplateName("");
      setToast("Template saved");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to save template");
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId) return;
    setTemplateDeleting(true);
    try {
      const res = await fetch(`/api/admin/review/templates/${selectedTemplateId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete template");
      }
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== selectedTemplateId));
      setSelectedTemplateId(null);
      setToast("Template deleted");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to delete template");
    } finally {
      setTemplateDeleting(false);
    }
  };

  if (!listing) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Review workspace</div>
          <p className="text-xs text-slate-600">Select a listing to review</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-600">
          {hasListings ? (
            <div>
              <p className="font-semibold text-slate-900">Select a listing to review</p>
              <p className="text-xs text-slate-600">Queue size: {filteredIds.length}</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.emptyTitle}</p>
              <p className="text-xs text-slate-600">{ADMIN_REVIEW_COPY.list.emptyBody}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
            <p className="text-xs text-slate-600">
              {locationLine || "Location unknown"} · {listing.status || "pending"}
            </p>
            <p className="text-[11px] text-slate-500">Owner: {listing.hostName}</p>
            {detailLoading && <p className="text-[11px] text-slate-500">Loading details…</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(listing.id);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 1500);
                } catch {
                  /* ignore */
                }
              }}
              className="rounded border border-slate-200 px-2 py-1"
            >
              {copiedId ? "Copied ID" : "Copy ID"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1"
              onClick={onClose}
            >
              {ADMIN_REVIEW_COPY.drawer.close}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {toast}
        </div>
      )}
      {detailError && (
        <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Failed to load details: {detailError}.{" "}
          <a className="font-semibold underline" href="/api/admin/review/diagnostics" target="_blank" rel="noreferrer">
            Diagnostics
          </a>
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              const debugJson = JSON.stringify({ listingId: listing?.id, error: detailError }, null, 2);
              try {
                void navigator.clipboard?.writeText(debugJson);
              } catch {
                /* ignore */
              }
            }}
          >
            Copy debug
          </button>
        </div>
      )}
      {isHiddenByFilters && (
        <div className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {ADMIN_REVIEW_COPY.list.hiddenNotice}{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={onShowHidden}
          >
            {ADMIN_REVIEW_COPY.list.showHidden}
          </button>
        </div>
      )}

      <div className="flex-1 divide-y divide-slate-200 pb-24">
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.media}</h3>
            {detail && (
              <span className="text-xs text-slate-600">
                Photos: {detail.listing.photo_count ?? 0} · Videos: {detail.listing.has_video ? "Yes" : "No"}
              </span>
            )}
          </div>
          {detail?.listing.cover_image_url && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.listing.cover_image_url} alt="Cover" className="h-48 w-full object-cover" />
              <div className="px-2 py-1 text-[11px] text-slate-600">Cover</div>
            </div>
          )}
          {images.length === 0 && videos.length === 0 && (
            <p className="text-sm text-slate-600">No media found for this listing.</p>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {img.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.image_url} alt="Listing photo" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="h-32 w-full bg-slate-100" />
                  )}
                  <div className="px-2 py-1 text-[11px] text-slate-600">
                    {img.width && img.height ? `${img.width}×${img.height}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
          {videos.length > 0 && (
            <div className="space-y-2 text-xs text-slate-700">
              {videos.map((vid) => (
                <div key={vid.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="font-semibold text-slate-900">Video</div>
                  <div className="break-all text-slate-700">{vid.video_url || "(no url)"}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Key facts</h3>
          <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-700">
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Price:{" "}
              {detail?.listing.price === null || detail?.listing.price === undefined
                ? "—"
                : `${detail.listing.currency || "NGN"} ${detail.listing.price}`}
              {detail?.listing.rent_period ? ` / ${detail.listing.rent_period}` : ""}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Beds/Baths: {detail?.listing.bedrooms ?? "—"} bd · {detail?.listing.bathrooms ?? "—"} ba
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Type: {detail?.listing.listing_type || detail?.listing.rental_type || "—"}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Active:{" "}
              {detail?.listing.is_active === null || detail?.listing.is_active === undefined
                ? "—"
                : detail.listing.is_active
                  ? "Yes"
                  : "No"}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Submitted: {detail?.listing.submitted_at || "—"}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              Updated: {detail?.listing.updated_at || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">Risk flags</div>
            <ul className="mt-1 list-disc pl-4">
              {!listing.hasCover || listing.photoCount === 0 ? <li>Missing cover or photos</li> : null}
              {listing.locationQuality !== "strong" ? <li>Location needs verification</li> : null}
              {listing.price == null || !listing.currency ? <li>Pricing incomplete</li> : null}
              {listing.title.length < 10 ? <li>Title is short</li> : null}
              {listing.hasVideo ? null : <li>No video uploaded</li>}
            </ul>
          </div>
          {detail && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
              <dt className="font-semibold text-slate-900">City</dt>
              <dd>{detail.listing.city || "—"}</dd>
              <dt className="font-semibold text-slate-900">State/Region</dt>
              <dd>{detail.listing.state_region || "—"}</dd>
              <dt className="font-semibold text-slate-900">Country</dt>
              <dd>{detail.listing.country_code || "—"}</dd>
              <dt className="font-semibold text-slate-900">Place ID</dt>
              <dd>{detail.listing.location_place_id || "—"}</dd>
              <dt className="font-semibold text-slate-900">Latitude</dt>
              <dd>{detail.listing.latitude ?? "—"}</dd>
              <dt className="font-semibold text-slate-900">Longitude</dt>
              <dd>{detail.listing.longitude ?? "—"}</dd>
              <dt className="font-semibold text-slate-900">Label</dt>
              <dd>{detail.listing.location_label || "—"}</dd>
            </dl>
          )}
        </section>

        <section className="p-4" data-checklist-default="collapsed">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist summary</div>
          <div className="flex flex-wrap gap-2">
            {checklistSummary.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => {
                  setChecklistOpen(true);
                  setScrollTarget(section.key);
                }}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                aria-label={`Checklist ${section.label}`}
              >
                <span className="font-semibold">{section.label}</span>
                <ChecklistChip status={section.status} />
              </button>
            ))}
          </div>
          <details
            open={checklistOpen}
            onToggle={(event) => setChecklistOpen((event.target as HTMLDetailsElement).open)}
            className="mt-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Review checklist</summary>
            <div className="mt-3">
              <AdminReviewChecklistPanel
                listing={listing}
                onChecklistChange={setChecklistState}
                scrollToSection={scrollTarget}
                onSectionScrolled={() => setScrollTarget(null)}
              />
            </div>
          </details>
        </section>

        <section className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.reasonsTitle}</h3>
            <button
              type="button"
              className="text-xs text-slate-600 underline underline-offset-2"
              onClick={() => {
                setMessageText(buildRequestChangesMessage(reasons));
                setMessageEdited(false);
              }}
            >
              {ADMIN_REVIEW_COPY.drawer.regenerate}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-700">
            {REVIEW_REASONS.map((reason) => (
              <label key={reason.code} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={reasons.includes(reason.code)}
                  onChange={() => toggleReason(reason.code)}
                />
                <span>{reason.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <label className="text-xs font-semibold text-slate-800">
              {ADMIN_REVIEW_COPY.drawer.messageLabel}
              <textarea
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  setMessageEdited(true);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                rows={4}
                placeholder={ADMIN_REVIEW_COPY.drawer.messageHelper}
              />
            </label>
            <p className="text-xs text-slate-600">{ADMIN_REVIEW_COPY.drawer.messageHelper}</p>
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="font-semibold text-slate-700">Templates</label>
              <select
                value={selectedTemplateId ?? ""}
                onChange={(e) => applyTemplate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={deleteTemplate}
                  disabled={templateDeleting}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-rose-700"
                >
                  {templateDeleting ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={saveTemplate}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                Save as template
              </button>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-xs font-semibold text-slate-800">{ADMIN_REVIEW_COPY.drawer.previewLabel}</p>
            <pre className="whitespace-pre-wrap text-xs text-slate-700">{previewMessage}</pre>
          </div>
        </section>

        <section className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
          <ul className="space-y-2 text-xs text-slate-700">
            {detail?.listing?.submitted_at && <li>Submitted: {detail.listing.submitted_at}</li>}
            {detail?.listing?.updated_at && <li>Updated: {detail.listing.updated_at}</li>}
            {activity.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="font-semibold text-slate-900">
                  {item.action_type} by {item.actor_name || item.actor_id || "admin"}
                </div>
                <div className="text-xs text-slate-600">{item.created_at || ""}</div>
                {typeof item.payload_json === "object" &&
                  item.payload_json &&
                  "message" in item.payload_json && (
                    <div className="mt-1 text-[11px] text-slate-600">
                      {String((item.payload_json as { message?: string }).message || "").slice(0, 140)}
                    </div>
                  )}
              </li>
            ))}
            {!activity.length && <li>No review activity yet.</li>}
          </ul>
        </section>

        {!actionsEnabled && (
          <section className="p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              This listing is read-only in the Listings registry.{" "}
              {canReview ? (
                <a className="font-semibold underline" href={`/admin/review?id=${encodeURIComponent(listing.id)}`}>
                  Open in Review queue
                </a>
              ) : (
                <span>Only reviewable listings can be approved or rejected.</span>
              )}
            </div>
          </section>
        )}
      </div>

      {actionsEnabled && (
        <section className="sticky bottom-0 z-20 border-t border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              disabled={!prevId}
              onClick={() => prevId && onNavigate(prevId)}
              className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              {ADMIN_REVIEW_COPY.drawer.previous}
            </button>
            <button
              type="button"
              disabled={!nextId}
              onClick={() => nextId && onNavigate(nextId)}
              className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              {ADMIN_REVIEW_COPY.drawer.next}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={submitting !== null || !effectiveCanApprove}
              onClick={handleApprove}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting === "approve" ? "Approving..." : "Approve listing"}
            </button>
            {!effectiveCanApprove && (
              <div className="text-xs text-amber-700">
                {missingLabels ? `Complete checklist: ${missingLabels}` : approveReason}
              </div>
            )}
            <button
              type="button"
              disabled={submitting !== null}
              onClick={handleSendRequest}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting === "request" ? "Sending..." : ADMIN_REVIEW_COPY.drawer.sendRequest}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={handleReject}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {submitting === "reject" ? "Rejecting..." : "Reject listing"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
