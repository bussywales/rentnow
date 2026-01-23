"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";
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
};

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
}: Props) {
  const isOpen = !!listing;
  const [reasons, setReasons] = useState<ReviewReasonCode[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "request" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
      return;
    }
    const parsed = parseRejectionReason(listing.rejectionReason);
    const normalized = normalizeReasons(parsed.reasons);
    const initialMessage = parsed.message || buildRequestChangesMessage(normalized);
    setReasons(normalized);
    setMessageText(initialMessage);
    setMessageEdited(false);
    setSubmitting(null);
    setToast(null);
  }, [listing]);

  const previewMessage = useMemo(() => {
    const trimmed = messageText.trim();
    return trimmed || buildRequestChangesMessage(reasons);
  }, [messageText, reasons]);

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
        <section className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.overview}</h3>
          <p className="mt-2 text-sm text-slate-700">
            {listing
              ? `${listing.readiness.tier} (${listing.readiness.score}) · ${locationLine || "Location unknown"}`
              : ADMIN_REVIEW_COPY.drawer.placeholder}
          </p>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.media}</h3>
          <p className="mt-2 text-sm text-slate-600">Media previews will appear here.</p>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.location}</h3>
          <p className="mt-2 text-sm text-slate-600">Location details will appear here.</p>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.drawer.notes}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {listing ? "Internal notes (read-only in this slice)." : ADMIN_REVIEW_COPY.list.noSelection}
          </p>
        </section>
        {listing && (
          <section className="flex flex-col gap-3 p-4">
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
              disabled={submitting !== null}
              onClick={handleApprove}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting === "approve" ? "Approving..." : "Approve listing"}
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
        {!listing && hasListings && (
          <section className="p-4 text-sm text-slate-600">{ADMIN_REVIEW_COPY.list.noSelection}</section>
        )}
      </div>
    </div>
  );
}
