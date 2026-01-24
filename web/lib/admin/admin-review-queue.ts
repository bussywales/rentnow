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

export function buildReviewableOrClause(pendingSet: string[] = PENDING_STATUS_LIST): string {
  const pendingStatuses = pendingSet.map((s) => `status.eq.${s}`).join(",");
  return `${pendingStatuses},status.ilike.pending%,submitted_at.not.is.null`;
}

export type ReviewableRow = {
  status?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  paused_at?: string | null;
  is_active?: boolean | null;
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

export function applyReviewableFilters(query: FilterBuilder, pendingSet: string[] = PENDING_STATUS_LIST) {
  return query
    .eq("is_approved", false)
    .is("approved_at", null)
    .is("rejected_at", null)
    .or(buildReviewableOrClause(pendingSet));
}

export async function getAdminReviewQueue<T extends string>({
  userClient,
  serviceClient,
  viewerRole,
  select,
  limit,
  view = "pending",
}: {
  userClient: AnyClient;
  serviceClient?: AnyClient | null;
  viewerRole?: string | null;
  select: T;
  limit?: number;
  view?: ReviewViewKey;
}) {
  const canUseService = viewerRole === "admin" && !!serviceClient;
  let fallbackReason: string | null = null;
  const runQuery = async (client: AnyClient, source: "service" | "user") => {
    let query = client.from("properties").select(select, { count: "exact" });
    if (view === "pending" || view === "all") {
      query = applyReviewableFilters(query);
    } else {
      query = query.eq("is_approved", false).is("approved_at", null).is("rejected_at", null).or(buildStatusOrFilter(view));
    }
    if (limit) query = query.limit(limit);
    query = query.order("updated_at", { ascending: false });
    const result = await query;
    return {
      source,
      data: result.data,
      count: result.count,
      error: result.error,
      status: (result as { status?: number }).status ?? null,
    };
  };

  const primary = await runQuery(canUseService ? serviceClient : userClient, canUseService ? "service" : "user");
  let fallback: typeof primary | null = null;

  if (primary.source === "service" && (primary.error || (primary.status && primary.status >= 400))) {
    fallbackReason = primary.error?.message || `service_status_${primary.status ?? "unknown"}`;
    fallback = await runQuery(userClient, "user");
  }

  const chosen = fallback ?? primary;

  return {
    data: chosen.data,
    count: chosen.count,
    meta: {
      source: chosen.source,
      serviceAttempted: canUseService,
      serviceOk: !primary.error && (!primary.status || primary.status < 400),
      serviceStatus: primary.status,
      serviceError: primary.error?.message,
      fallbackReason,
    },
    serviceRoleAvailable: canUseService,
    serviceRoleError: primary.source === "service" ? primary.error : null,
    serviceRoleStatus: primary.status,
  };
}
