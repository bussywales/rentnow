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

export function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.toString().trim().toLowerCase();
}

export type ReviewViewKey = "pending" | "changes" | "approved" | "all";

export function getStatusesForView(view: ReviewViewKey): string[] {
  if (view === "pending") return [...PENDING_STATUS_LIST];
  if (view === "changes") return [...CHANGES_STATUS_LIST];
  if (view === "approved") return [...APPROVED_STATUS_LIST];
  return [...ALL_REVIEW_STATUSES];
}

export function isStatusInView(status: string | null | undefined, view: ReviewViewKey) {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  if (view === "pending") {
    if (normalized.startsWith("pending")) return true;
    return PENDING_STATUS_LIST.includes(normalized);
  }
  if (view === "changes") return CHANGES_STATUS_LIST.includes(normalized);
  if (view === "approved") return APPROVED_STATUS_LIST.includes(normalized);
  return ALL_REVIEW_STATUSES.includes(normalized);
}

export function buildStatusOrFilter(view: ReviewViewKey): string {
  const clauses: string[] = [];
  if (view === "pending" || view === "all") {
    const basePending = PENDING_STATUS_LIST.map((s) => `status.eq.${s}`);
    clauses.push(...basePending, "status.ilike.pending%");
  }
  if (view === "changes" || view === "all") {
    clauses.push(...CHANGES_STATUS_LIST.map((s) => `status.eq.${s}`));
  }
  if (view === "approved" || view === "all") {
    clauses.push(...APPROVED_STATUS_LIST.map((s) => `status.eq.${s}`));
  }
  // Supabase .or uses comma-separated conditions
  return clauses.join(",");
}
