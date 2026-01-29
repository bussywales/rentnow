"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { z } from "zod";
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
      return;
    }
    setSelectedIdSnapshot(listing.id);
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

  if (!listing && !hasListings) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        <p className="font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.emptyTitle}</p>
        <p>{ADMIN_REVIEW_COPY.list.emptyBody}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition ${
        isOpen ? "opacity-100" : "opacity-60"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {listing?.title || ADMIN_REVIEW_COPY.list.noSelection}
          </p>
          {listing?.updatedAt && (
            <p className="text-xs text-slate-600">Updated {formatRelativeTime(listing.updatedAt)}</p>
          )}
        </div>
        <button
          type="button"
          className="text-sm text-slate-500 hover:text-slate-800"
          onClick={onClose}
          disabled={!isOpen}
        >
          {ADMIN_REVIEW_COPY.drawer.close}
        </button>
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
      {isHiddenByFilters && listing && (
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

      <div className="divide-y divide-slate-200">
        <section className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.overview}</h3>
              <p className="mt-1 text-sm text-slate-700">
                {listing
                  ? `${listing.readiness.tier} (${listing.readiness.score}) · ${locationLine || "Location unknown"}`
                  : ADMIN_REVIEW_COPY.drawer.placeholder}
              </p>
              {listing && (
                <p className="text-xs text-slate-600">
                  Host: {listing.hostName} · Updated {listing.updatedAt ? formatRelativeTime(listing.updatedAt) : "—"}
                </p>
              )}
            </div>
            {detailLoading && <span className="text-xs text-slate-500">Loading…</span>}
            {detailError && <span className="text-xs text-rose-600">{detailError}</span>}
          </div>
          {detail && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-700">
              <dt className="font-semibold text-slate-900">Status</dt>
              <dd className="capitalize">{detail.listing.status || "pending"}</dd>
              <dt className="font-semibold text-slate-900">Submitted</dt>
              <dd>{detail.listing.submitted_at || "—"}</dd>
              <dt className="font-semibold text-slate-900">Photos</dt>
              <dd>{detail.listing.photo_count ?? 0}</dd>
              <dt className="font-semibold text-slate-900">Video</dt>
              <dd>{detail.listing.has_video ? "Yes" : "No"}</dd>
              <dt className="font-semibold text-slate-900">Cover</dt>
              <dd>{detail.listing.cover_image_url ? "Set" : "Missing"}</dd>
              <dt className="font-semibold text-slate-900">Owner</dt>
              <dd>{listing?.hostName || detail.listing.id}</dd>
              <dt className="font-semibold text-slate-900">Active</dt>
              <dd>
                {detail.listing.is_active === null || detail.listing.is_active === undefined
                  ? "—"
                  : detail.listing.is_active
                    ? "Yes"
                    : "No"}
              </dd>
              <dt className="font-semibold text-slate-900">Price</dt>
              <dd>
                {detail.listing.price === null || detail.listing.price === undefined
                  ? "—"
                  : `${detail.listing.currency || "NGN"} ${detail.listing.price}`}
                {detail.listing.rent_period ? ` / ${detail.listing.rent_period}` : ""}
              </dd>
              <dt className="font-semibold text-slate-900">Type</dt>
              <dd>{detail.listing.listing_type || detail.listing.rental_type || "—"}</dd>
              <dt className="font-semibold text-slate-900">Beds/Baths</dt>
              <dd>
                {detail.listing.bedrooms ?? "—"} bd · {detail.listing.bathrooms ?? "—"} ba
              </dd>
            </dl>
          )}
          {listing && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Risk flags</div>
              <ul className="mt-1 list-disc pl-4">
                {!listing.hasCover || listing.photoCount === 0 ? (
                  <li>Missing cover or photos</li>
                ) : null}
                {listing.locationQuality !== "strong" ? <li>Location needs verification</li> : null}
                {listing.price == null || !listing.currency ? <li>Pricing incomplete</li> : null}
                {listing.title.length < 10 ? <li>Title is short</li> : null}
                {listing.hasVideo ? null : <li>No video uploaded</li>}
              </ul>
            </div>
          )}
        </section>
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
              <img src={detail.listing.cover_image_url} alt="Cover" className="h-40 w-full object-cover" />
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
        <section className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.location}</h3>
          {detail ? (
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
          ) : (
            <p className="text-sm text-slate-600">Location details will appear here.</p>
          )}
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.notes}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {listing ? "Internal notes (read-only in this slice)." : ADMIN_REVIEW_COPY.list.noSelection}
          </p>
        </section>
        <section className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
          <ul className="space-y-2 text-xs text-slate-700">
            {detail?.listing?.submitted_at && (
              <li>Submitted: {detail.listing.submitted_at}</li>
            )}
            {detail?.listing?.updated_at && (
              <li>Updated: {detail.listing.updated_at}</li>
            )}
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
        {listing && actionsEnabled && (
          <section className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white p-4">
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
            <button
              type="button"
              disabled={submitting !== null || !canApprove}
              onClick={handleApprove}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
                {submitting === "approve" ? "Approving..." : "Approve listing"}
              </button>
            {!canApprove && approveDisabledReason && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {approveDisabledReason}
              </div>
            )}
            <button
              type="button"
              disabled={submitting !== null}
              onClick={handleReject}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {submitting === "reject" ? "Rejecting..." : "Reject listing"}
            </button>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.reasonsTitle}</h4>
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
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
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
              <div className="mt-3 flex items-center gap-2">
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
                  className="text-xs text-slate-600 hover:text-slate-800"
                  onClick={() => {
                    setMessageEdited(false);
                    setToast(null);
                  }}
                  disabled={submitting !== null}
                >
                  {ADMIN_REVIEW_COPY.drawer.cancelRequest}
                </button>
              </div>
            </div>
          </section>
        )}
        {listing && !actionsEnabled && (
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
        {!listing && hasListings && (
          <section className="p-4 text-sm text-slate-600">{ADMIN_REVIEW_COPY.list.noSelection}</section>
        )}
      </div>
    </div>
  );
}
