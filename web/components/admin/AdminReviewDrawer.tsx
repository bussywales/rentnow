"use client";

import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { useMemo, useState } from "react";
import { validateRequestNote } from "@/lib/admin/admin-review-actions";

type Props = {
  listing: AdminReviewListItem | null;
  onClose: () => void;
  locationLine: string;
  onActionComplete: (id: string) => void;
  isHiddenByFilters: boolean;
  onShowHidden: () => void;
  filteredIds: string[];
  onNavigate: (id: string) => void;
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
}: Props) {
  const isOpen = !!listing;
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "request" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navIds = filteredIds;
  const currentIndex = useMemo(() => (listing ? navIds.indexOf(listing.id) : -1), [listing, navIds]);
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < navIds.length - 1 ? navIds[currentIndex + 1] : null;
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition ${
        isOpen ? "opacity-100" : "opacity-60"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{listing?.title || ADMIN_REVIEW_COPY.drawer.placeholder}</p>
          {listing?.updatedAt && (
            <p className="text-xs text-slate-600">
              Updated {formatRelativeTime(listing.updatedAt)}
            </p>
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

      {message && (
        <div className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
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
          <p className="mt-2 text-sm text-slate-600">Internal notes (read-only in this slice).</p>
        </section>
        {listing && (
          <section className="flex flex-col gap-2 p-4">
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
              onClick={async () => {
                setSubmitting("approve");
                setMessage(null);
                try {
                  const res = await fetch(`/api/admin/properties/${listing.id}/approve`, { method: "POST" });
                  if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || "Unable to approve");
                  }
                  setMessage("Listing approved.");
                  onActionComplete(listing.id);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Unable to approve");
                } finally {
                  setSubmitting(null);
                }
              }}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting === "approve" ? "Approving..." : "Approve listing"}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => {
                setRequestingChanges(true);
                setMessage(null);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Request changes
            </button>
            {requestingChanges && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs font-semibold text-slate-800">
                  Message to host (required)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    rows={3}
                    placeholder="Be specific. Tell them what to fix before resubmitting."
                  />
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={async () => {
                      const validation = validateRequestNote(note);
                      if (!validation.ok) {
                        setMessage(validation.message || "Note required.");
                        return;
                      }
                      setSubmitting("request");
                      setMessage(null);
                      try {
                        const res = await fetch(`/api/admin/properties/${listing.id}/request-changes`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ note }),
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => null);
                          throw new Error(data?.error || "Unable to send request");
                        }
                        setMessage("Request sent to host.");
                        onActionComplete(listing.id);
                        setRequestingChanges(false);
                        setNote("");
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : "Unable to send request");
                      } finally {
                        setSubmitting(null);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {submitting === "request" ? "Sending..." : "Send request"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-slate-600 hover:text-slate-800"
                    onClick={() => {
                      setRequestingChanges(false);
                      setNote("");
                    }}
                    disabled={submitting !== null}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
