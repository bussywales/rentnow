const REVIEW_VIEW_STATUSES = {
  pending: ["pending", "pending_review", "pending_approval", "submitted"],
  changes: ["changes_requested"],
  approved: ["live", "approved"],
} as const;

export const PENDING_STATUS_LIST = [...REVIEW_VIEW_STATUSES.pending];
export const APPROVED_STATUS_LIST = [...REVIEW_VIEW_STATUSES.approved];
export const CHANGES_STATUS_LIST = [...REVIEW_VIEW_STATUSES.changes];
export const ALL_REVIEW_STATUSES = Array.from(
  new Set([...PENDING_STATUS_LIST, ...CHANGES_STATUS_LIST, ...APPROVED_STATUS_LIST])
);

export type ReviewViewKey = "pending" | "changes" | "approved" | "all";

export function getStatusesForView(view: ReviewViewKey): string[] {
  if (view === "pending") return [...PENDING_STATUS_LIST];
  if (view === "changes") return [...CHANGES_STATUS_LIST];
  if (view === "approved") return [...APPROVED_STATUS_LIST];
  return [...ALL_REVIEW_STATUSES];
}

export function isStatusInView(status: string | null | undefined, view: ReviewViewKey) {
  if (!status) return false;
  const statuses = getStatusesForView(view);
  return statuses.includes(status);
}
