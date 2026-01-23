"use client";

import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";

type Props = {
  listings: AdminReviewListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function ReadinessBadge({ tier, score }: { tier: string; score: number }) {
  const tone =
    tier === "Excellent"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tier === "Good"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-rose-50 text-rose-700 border-rose-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {tier} ({score})
    </span>
  );
}

export function AdminReviewList({ listings, selectedId, onSelect }: Props) {
  return (
    <div className="divide-y divide-slate-200">
      {listings.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`w-full text-left transition hover:bg-slate-50 ${
            selectedId === item.id ? "bg-slate-50" : "bg-white"
          }`}
        >
          <div className="flex items-start justify-between px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <ReadinessBadge tier={item.readiness.tier} score={item.readiness.score} />
              </div>
              <p className="text-xs text-slate-600">
                {ADMIN_REVIEW_COPY.list.columns.host}: {item.hostName}
              </p>
              <p className="text-xs text-slate-600">
                {ADMIN_REVIEW_COPY.list.columns.location}: {item.locationQuality}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  {ADMIN_REVIEW_COPY.list.columns.photos}: {item.photoCount}
                </span>
                <span>
                  {ADMIN_REVIEW_COPY.list.columns.video}: {item.hasVideo ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500">{formatRelativeTime(item.updatedAt || null)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
