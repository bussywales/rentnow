export const ALLOWED_PROPERTY_STATUSES = ["draft", "pending", "live", "rejected", "paused"] as const;
const REVIEW_VIEW_STATUSES = {
  pending: ["pending"],
  changes: ["draft"],
  approved: ["live"],
  rejected: ["rejected"],
} as const;

export const PENDING_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.pending];
export const APPROVED_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.approved];
export const CHANGES_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.changes];
export const REJECTED_STATUS_LIST: string[] = [...REVIEW_VIEW_STATUSES.rejected];
export const ALL_REVIEW_STATUSES: string[] = Array.from(
  new Set([...PENDING_STATUS_LIST, ...CHANGES_STATUS_LIST, ...APPROVED_STATUS_LIST, ...REJECTED_STATUS_LIST])
);

export function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.toString().trim().toLowerCase();
}

export function sanitizeStatusSet(statuses: string[]): string[] {
  const normalized = statuses
    .map((s) => normalizeStatus(s))
    .filter((s): s is string => !!s)
    .filter((s) => (ALLOWED_PROPERTY_STATUSES as readonly string[]).includes(s));
  return Array.from(new Set(normalized));
}

export function buildReviewableOrClause(pendingSet: string[] = PENDING_STATUS_LIST): string {
  const pendingStatuses = sanitizeStatusSet(pendingSet).map((s) => `status.eq.${s}`).join(",");
  return `${pendingStatuses},submitted_at.not.is.null`;
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
    ? PENDING_STATUS_LIST.includes(normalized)
    : false;
  const hasSubmitted = !!row.submitted_at;
  if (!(isPendingStatus || hasSubmitted)) return false;
  if (row.is_approved === true) return false;
  if (row.approved_at) return false;
  if (row.rejected_at) return false;
  return true;
}

export function isFixRequestRow(row: {
  status?: string | null;
  submitted_at?: string | null;
  rejection_reason?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
}): boolean {
  const normalized = normalizeStatus(row.status);
  if (normalized !== "draft") return false;
  if (!row.submitted_at) return false;
  if (!row.rejection_reason) return false;
  if (row.is_approved === true) return false;
  if (row.approved_at) return false;
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
  if (view === "pending") return PENDING_STATUS_LIST.includes(normalized);
  if (view === "changes") return CHANGES_STATUS_LIST.includes(normalized);
  if (view === "approved") return APPROVED_STATUS_LIST.includes(normalized);
  return ALL_REVIEW_STATUSES.includes(normalized);
}

export function buildStatusOrFilter(view: ReviewViewKey): string {
  const clauses: string[] = [];
  const pendingStatuses = sanitizeStatusSet(PENDING_STATUS_LIST);
  const changeStatuses = sanitizeStatusSet(CHANGES_STATUS_LIST);
  const approvedStatuses = sanitizeStatusSet(APPROVED_STATUS_LIST);
  if (view === "pending" || view === "all") {
    const basePending = pendingStatuses.map((s) => `status.eq.${s}`);
    clauses.push(...basePending);
  }
  if (view === "changes" || view === "all") {
    clauses.push(...changeStatuses.map((s) => `status.eq.${s}`));
  }
  if (view === "approved" || view === "all") {
    clauses.push(...approvedStatuses.map((s) => `status.eq.${s}`));
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

export async function fetchReviewableUnion<T extends string>(
  client: AnyClient,
  select: T,
  pendingSet: string[] = PENDING_STATUS_LIST
) {
  const sanitizedPendingSet = sanitizeStatusSet(pendingSet);
  const baseFilters = (q: FilterBuilder) => q.eq("is_approved", false).is("approved_at", null).is("rejected_at", null);
  const queryA = baseFilters(client.from("properties").select(select, { count: "exact" })).in("status", sanitizedPendingSet);
  const queryB = baseFilters(
    client.from("properties").select(select, { count: "exact" }).not("submitted_at", "is", null)
  );

  const [resA, resB] = await Promise.all([queryA, queryB]);
  const rowsA = (resA.data as AnyClient[]) || [];
  const rowsB = (resB.data as AnyClient[]) || [];

  const merged = new Map<string, AnyClient>();
  [...rowsA, ...rowsB].forEach((row: { id?: string }) => {
    const id = row?.id;
    if (!id) return;
    if (!merged.has(id)) {
      merged.set(id, row);
    }
  });

  const mergedArray = Array.from(merged.values());
  mergedArray.sort((a, b) => {
    const aDate = a?.updated_at || a?.submitted_at || a?.created_at || "";
    const bDate = b?.updated_at || b?.submitted_at || b?.created_at || "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return {
    data: mergedArray,
    count: mergedArray.length,
    debug: {
      queryAStatus: (resA as { status?: number }).status ?? null,
      queryBStatus: (resB as { status?: number }).status ?? null,
      queryAError: resA.error || null,
      queryBError: resB.error || null,
      queryACount: resA.count ?? rowsA.length,
      queryBCount: resB.count ?? rowsB.length,
      pendingSetRequested: pendingSet,
      pendingSetSanitized: sanitizedPendingSet,
      droppedStatuses: pendingSet.filter((s) => !sanitizedPendingSet.includes(normalizeStatus(s || "") || "")),
    },
  };
}

export async function getAdminReviewQueue<T extends string>({
  userClient,
  serviceClient,
  viewerRole,
  select,
  limit,
  view = "pending",
  pendingSet = PENDING_STATUS_LIST,
}: {
  userClient: AnyClient;
  serviceClient?: AnyClient | null;
  viewerRole?: string | null;
  select: T;
  limit?: number;
  view?: ReviewViewKey;
  pendingSet?: string[];
}) {
  const canUseService = viewerRole === "admin" && !!serviceClient;
  let fallbackReason: string | null = null;
  const runUnion = async (client: AnyClient, source: "service" | "user") => {
    if (view === "changes") {
      const baseFilters = (q: FilterBuilder) =>
        q.eq("is_approved", false).is("approved_at", null).is("rejected_at", null);
      let query = baseFilters(client.from("properties").select(select, { count: "exact" })).eq("status", "draft").not(
        "submitted_at",
        "is",
        null
      );
      query = query.not("rejection_reason", "is", null);
      if (limit) query = query.limit(limit);
      query = query.order("updated_at", { ascending: false });
      const result = await query;
      return {
        source,
        data: result.data,
        count: result.count,
        error: result.error,
        status: (result as { status?: number }).status ?? null,
        debug: { select, filter: "draft+submitted+rejection_reason" },
      };
    }
    if (view !== "pending" && view !== "all") {
      // For other views, keep existing filter
      let query = client.from("properties").select(select, { count: "exact" });
      const orClause = buildStatusOrFilter(view);
      query = query.eq("is_approved", false).is("approved_at", null).is("rejected_at", null).or(orClause);
      if (limit) query = query.limit(limit);
      query = query.order("updated_at", { ascending: false });
      const result = await query;
      return {
        source,
        data: result.data,
        count: result.count,
        error: result.error,
        status: (result as { status?: number }).status ?? null,
        debug: { orClause, select },
      };
    }
    const unionResult = await fetchReviewableUnion(client, select, pendingSet);
    const trimmedData = limit ? unionResult.data.slice(0, limit) : unionResult.data;
    return {
      source,
      data: trimmedData,
      count: unionResult.count,
      error: unionResult.debug.queryAError || unionResult.debug.queryBError || null,
      status: unionResult.debug.queryAStatus || unionResult.debug.queryBStatus || null,
      debug: {
        queryAStatus: unionResult.debug.queryAStatus,
        queryBStatus: unionResult.debug.queryBStatus,
        queryAError: unionResult.debug.queryAError,
        queryBError: unionResult.debug.queryBError,
        pendingSetRequested: unionResult.debug.pendingSetRequested,
        pendingSetSanitized: unionResult.debug.pendingSetSanitized,
        droppedStatuses: unionResult.debug.droppedStatuses,
        select,
      },
    };
  };

  const primary = await runUnion(canUseService ? serviceClient : userClient, canUseService ? "service" : "user");
  let fallback: typeof primary | null = null;

  if (primary.source === "service" && (primary.error || (primary.status && primary.status >= 400))) {
    fallbackReason = primary.error?.message || `service_status_${primary.status ?? "unknown"}`;
    fallback = await runUnion(userClient, "user");
  }

  const chosen = fallback ?? primary;
  const chosenRowsValue = (chosen as { rows?: unknown[] | null }).rows;
  const candidateRows = Array.isArray(chosenRowsValue) ? chosenRowsValue : chosen.data;
  const mergedRows = Array.isArray(candidateRows) ? candidateRows : [];
  const mergedCount = typeof chosen.count === "number" ? chosen.count : mergedRows.length;

  return {
    data: mergedRows,
    rows: mergedRows,
    count: mergedCount,
    meta: {
      source: chosen.source,
      serviceAttempted: canUseService,
      serviceOk: !primary.error && (!primary.status || primary.status < 400),
      serviceStatus: primary.status,
      serviceError: primary.error?.message,
      serviceErrorDetails: primary.error?.details,
      serviceErrorHint: primary.error?.hint,
      serviceErrorCode: (primary.error as { code?: string })?.code,
      serviceDebug: primary.debug,
      fallbackReason,
    },
    serviceRoleAvailable: canUseService,
    serviceRoleError: primary.source === "service" ? primary.error : null,
    serviceRoleStatus: primary.status,
  };
}
