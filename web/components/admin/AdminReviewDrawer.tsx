"use client";

import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";

type Props = {
  listing: AdminReviewListItem | null;
  onClose: () => void;
  locationLine: string;
};

export function AdminReviewDrawer({ listing, onClose, locationLine }: Props) {
  const isOpen = !!listing;
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
      </div>
    </div>
  );
}
