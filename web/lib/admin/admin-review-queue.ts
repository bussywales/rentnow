const REVIEW_VIEW_STATUSES = {
  pending: ["pending", "pending_review", "pending_approval", "submitted"],
  changes: ["changes_requested"],
  approved: ["live", "approved"],
} as const;

export const PENDING_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.pending];
export const APPROVED_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.approved];
export const CHANGES_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.changes];
export const ALL_REVIEW_STATUSES: string[] = Array.from(
  new Set([...PENDING_STATUS_LIST, ...CHANGES_STATUS_LIST, ...APPROVED_STATUS_LIST])
);

export function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.toString().trim().toLowerCase();
}

export function buildReviewableOrClause(): string {
  const pendingClauses = PENDING_STATUS_LIST.map((s) => `status.eq.${s}`);
  pendingClauses.push("status.ilike.pending%");
  pendingClauses.push("submitted_at.not.is.null");
  return pendingClauses.join(",");
}

export type ReviewableRow = {
  status?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
};

export function isReviewableRow(row: ReviewableRow): boolean {
  const normalized = normalizeStatus(row.status);
  const isPendingStatus = normalized
    ? normalized.startsWith("pending") || PENDING_STATUS_LIST.includes(normalized)
    : false;
  const hasSubmitted = !!row.submitted_at;
  if (!(isPendingStatus || hasSubmitted)) return false;
  if (row.is_approved === true) return false;
  if (row.approved_at) return false;
  if (row.rejected_at) return false;
  return true;
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
  return clauses.join(",");
}

// Supabase types can be noisy in shared helpers; keep these helpers permissive.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterBuilder = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export function applyReviewableFilters(query: FilterBuilder) {
  return query
    .or(buildReviewableOrClause())
    .eq("is_approved", false)
    .is("approved_at", null)
    .is("rejected_at", null);
}

export async function getAdminReviewQueue<T extends string>({
  userClient,
  serviceClient,
  viewerRole,
  mode,
  select,
  limit,
}: {
  userClient: AnyClient;
  serviceClient?: AnyClient | null;
  viewerRole?: string | null;
  mode: "reviewable" | "allStatuses";
  select: T;
  limit?: number;
}) {
  const useServiceRole = viewerRole === "admin" && !!serviceClient;
  const client = useServiceRole && serviceClient ? serviceClient : userClient;
  let query = client.from("properties").select(select, { count: "exact" });
  query = mode === "reviewable" ? applyReviewableFilters(query) : query.or(buildStatusOrFilter("all"));
  if (limit) query = query.limit(limit);
  query = query.order("updated_at", { ascending: false });
  const result = await query;
  return {
    ...result,
    usedServiceRole: useServiceRole,
    serviceRoleAvailable: !!serviceClient,
  };
}
