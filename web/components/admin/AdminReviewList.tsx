"use client";

import { useState } from "react";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { formatLocationLine } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  density?: "comfortable" | "compact";
  showBulkSelect?: boolean;
  bulkFormId?: string;
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

export function AdminReviewList({
  listings,
  selectedId,
  onSelect,
  density = "comfortable",
  showBulkSelect = false,
  bulkFormId = "bulk-approvals",
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isCompact = density === "compact";

  return (
    <div className="divide-y divide-slate-200">
      {listings.map((item) => {
        const locationLine = formatLocationLine(item);
        const statusLabel =
          item.reviewStage === "changes"
            ? "changes requested"
            : item.reviewStage === "pending"
              ? "pending"
              : item.status || "pending";
        const missingCover = item.hasCover === false;
        const needsPhotos = item.photoCount === 0;
        const needsLocation = item.locationQuality && item.locationQuality !== "strong";
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
            data-testid="admin-review-queue-row"
            className={`group relative flex w-full cursor-pointer items-start gap-3 px-4 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              selectedId === item.id ? "bg-sky-50/60" : "bg-white"
            } ${isCompact ? "py-2" : "py-3"}`}
          >
            <span
              className={`absolute left-0 top-0 h-full w-1 rounded-r ${
                selectedId === item.id ? "bg-sky-500" : "bg-transparent group-hover:bg-slate-200"
              }`}
            />
            {showBulkSelect && (
              <div className="pt-1">
                <input
                  form={bulkFormId}
                  type="checkbox"
                  name="ids"
                  value={item.id}
                  aria-label={`Select ${item.title}`}
                  className="h-4 w-4 rounded border-slate-300"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span
                  data-review-status={statusLabel}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 shadow-sm border border-slate-200"
                >
                  {statusLabel}
                </span>
                {!isCompact && <ReadinessBadge tier={item.readiness.tier} score={item.readiness.score} />}
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600">
                  {missingCover && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                      Missing cover
                    </span>
                  )}
                  {needsPhotos && (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                      Needs photos
                    </span>
                  )}
                  {needsLocation && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                      Needs location
                    </span>
                  )}
                  {item.hasVideo && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      Has video
                    </span>
                  )}
                </div>
              </div>
              {!isCompact && (
                <p className="text-xs text-slate-600">
                  {ADMIN_REVIEW_COPY.list.columns.host}: {item.hostName}
                </p>
              )}
              <p className="text-xs text-slate-600">
                {locationLine || "Location unknown"}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  {ADMIN_REVIEW_COPY.list.columns.photos}: {item.photoCount}
                </span>
                <span>
                  {ADMIN_REVIEW_COPY.list.columns.video}: {item.hasVideo ? "Yes" : "No"}
                </span>
              </div>
              {!isCompact && (
                <p className="text-[11px] text-slate-500 break-all">
                  ID: {item.id}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={async (event) => {
                      event.stopPropagation();
                      try {
                        await navigator.clipboard?.writeText(item.id);
                        setCopiedId(item.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copiedId === item.id ? "Copied" : "Copy"}
                  </button>
                </p>
              )}
            </div>
            <div className="text-xs text-slate-500">{formatRelativeTime(item.updatedAt || null)}</div>
          </div>
        );
      })}
    </div>
  );
}
