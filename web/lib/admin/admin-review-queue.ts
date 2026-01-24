export const REVIEW_VIEW_STATUSES = {
  pending: ["pending", "pending_review", "pending_approval", "submitted"],
  changes: ["changes_requested"],
  approved: ["live", "approved"],
} as const;

export type ReviewViewKey = "pending" | "changes" | "approved" | "all";

export function getStatusesForView(view: ReviewViewKey): string[] {
  if (view === "pending") return [...REVIEW_VIEW_STATUSES.pending];
  if (view === "changes") return [...REVIEW_VIEW_STATUSES.changes];
  if (view === "approved") return [...REVIEW_VIEW_STATUSES.approved];
  return Array.from(
    new Set([
      ...REVIEW_VIEW_STATUSES.pending,
      ...REVIEW_VIEW_STATUSES.changes,
      ...REVIEW_VIEW_STATUSES.approved,
    ])
  );
}

export function isStatusInView(status: string | null | undefined, view: ReviewViewKey) {
  if (!status) return false;
  const statuses = getStatusesForView(view);
  return statuses.includes(status);
}
