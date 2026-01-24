import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv, normalizeSupabaseUrl } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import {
  applyReviewableFilters,
  buildReviewableOrClause,
  getStatusesForView,
  isReviewableRow,
  PENDING_STATUS_LIST,
  normalizeStatus,
} from "@/lib/admin/admin-review-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type QueueRow = {
  id: string;
  status: string | null;
  updated_at: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  is_active?: boolean | null;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: "/api/admin/review/diagnostics",
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const pendingStatuses = getStatusesForView("pending");
  const orFilter = buildReviewableOrClause();

  const { searchParams } = new URL(request.url);
  const lookupId = searchParams.get("id");

  const userQuery = applyReviewableFilters(
    supabase
      .from("properties")
      .select("id,status,updated_at,submitted_at,is_approved,is_active,approved_at,rejected_at", { count: "exact" })
  )
    .order("updated_at", { ascending: false })
    .limit(5);
  const userResult = await userQuery;
  const rows: QueueRow[] = (userResult.data ?? []) as QueueRow[];
  const userCount = userResult.count ?? 0;

  let note = "ok";
  const serviceKeyPresent = hasServiceRoleEnv();
  let serviceCount: number | null = serviceKeyPresent ? 0 : null;
  let serviceSample: { id: string; status: string | null; updated_at: string | null }[] = [];
  let serviceBranchAttempted = false;
  let serviceError: { name: string; message: string; details?: string } | null = null;
  let serviceStatus: number | null = null;
  if (auth.role === "admin" && serviceKeyPresent) {
    serviceBranchAttempted = true;
    try {
      const service = createServiceRoleClient();
      const serviceQuery = applyReviewableFilters(
        service
          .from("properties")
          .select("id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active", { count: "exact" })
      )
        .order("updated_at", { ascending: false })
        .limit(5);
      const srResult = await serviceQuery;
      serviceStatus = srResult.status ?? null;
      const srRows: QueueRow[] = (srResult.data ?? []) as QueueRow[];
      const srCount = srResult.count ?? 0;
      serviceCount = srCount;
      serviceSample = srRows.map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at ?? null }));
      if (userCount === 0 && srCount > 0) {
        note = "RLS or role may be blocking admin query";
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string; details?: string };
      serviceError = { name: e?.name || "Error", message: e?.message || "service role query failed", details: e?.details };
      note = "service role check failed";
      serviceCount = 0;
    }
  } else if (userCount === 0) {
    note = "service role unavailable; cannot confirm if rows exist";
  }

  const supabaseUrlRaw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrlRaw);
  const rawUrlPresent = !!supabaseUrlRaw;
  const rawUrlStartsWithHttp = supabaseUrlRaw.startsWith("http://") || supabaseUrlRaw.startsWith("https://");
  const urlHasScheme = !!normalizedUrl && (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://"));
  const normalizedUrlHost = (() => {
    try {
      const u = normalizedUrl ? new URL(normalizedUrl) : null;
      return u?.hostname ?? "unknown";
    } catch {
      return "unknown";
    }
  })();
  const projectRef = normalizedUrlHost;

  const statusCounts: Record<string, number> = {};
  const activeCounts: Record<string, number> = {};
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceRoleClient();
      const recentResult = await service
        .from("properties")
        .select("status,is_active")
        .order("updated_at", { ascending: false })
        .limit(50);
      const recent: { status: string | null; is_active: boolean | null }[] =
        (recentResult.data as { status: string | null; is_active: boolean | null }[]) ?? [];
      recent.forEach((r) => {
        const key = r.status ?? "unknown";
        statusCounts[key] = (statusCounts[key] || 0) + 1;
        const activeKey = `${r.is_active ? "active" : "inactive"}`;
        activeCounts[activeKey] = (activeCounts[activeKey] || 0) + 1;
      });
    } catch {
      /* ignore */
    }
  }

  let lookup: Record<string, unknown> | null = null;
  if (lookupId) {
    const { data: row } = await supabase
      .from("properties")
      .select("status,submitted_at,is_approved,is_active,approved_at,rejected_at,paused_at,owner_id")
      .eq("id", lookupId)
      .maybeSingle();
    lookup = row ?? null;
  }

  const rlsSuspected = userCount === 0 && serviceKeyPresent && (serviceCount ?? 0) > 0;

  const lookupReasoning = (() => {
    if (!lookup) return null;
    const row = lookup as QueueRow;
    const normalized = normalizeStatus(row.status ?? null);
    const matchedStatus = normalized ? normalized.startsWith("pending") || PENDING_STATUS_LIST.includes(normalized) : false;
    const hasSubmittedAt = !!row.submitted_at;
    const isApproved = row.is_approved === true;
    const approvedAtNull = !row.approved_at;
    const rejectedAtNull = !row.rejected_at;
    return { matchedStatus, hasSubmittedAt, isApproved, approvedAtNull, rejectedAtNull };
  })();

  return NextResponse.json({
    env: {
      supabase: projectRef,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      runtimeHint: (globalThis as { EdgeRuntime?: string }).EdgeRuntime ? "edge" : "node",
      rawUrlPresent,
      rawUrlStartsWithHttp,
      urlHasScheme,
      normalizedUrlHost,
    },
    viewer: { userId: auth.user.id, role: "admin" },
    pending: {
      statusSetUsed: pendingStatuses,
      count: userCount,
      sample: (rows ?? []).map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at })),
      serviceCount,
      serviceSample,
      userSample: (rows ?? []).map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at })),
      statusCounts,
      activeCounts,
      rlsSuspected,
      serviceKeyPresent,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
      serviceBranchAttempted,
      serviceError,
      serviceStatus,
      serviceOk: serviceError === null && serviceStatus !== null ? serviceStatus < 400 : serviceError === null,
      reviewableOrClauseUsed: orFilter,
    },
    lookup,
    notes: note,
    isReviewableSample: rows?.map((r: QueueRow) => ({
      id: r.id,
      reviewable: isReviewableRow({
        status: r.status,
        submitted_at: r.submitted_at,
        is_approved: r.is_approved,
        approved_at: r.approved_at,
        rejected_at: r.rejected_at,
      }),
    })),
    lookupIsReviewable: lookup ? isReviewableRow(lookup as QueueRow) : null,
    lookupReasoning,
  });
}
