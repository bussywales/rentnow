import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv, normalizeSupabaseUrl } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import {
  fetchReviewableUnion,
  getStatusesForView,
  isReviewableRow,
  PENDING_STATUS_LIST,
  normalizeStatus,
} from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT } from "@/lib/admin/admin-review-contracts";

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
  const supabaseUrlRaw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrlRaw);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const { searchParams } = new URL(request.url);
  const lookupId = searchParams.get("id");

  const userUnion = await fetchReviewableUnion(supabase, ADMIN_REVIEW_QUEUE_SELECT);
  const rows: QueueRow[] = (userUnion.data ?? []) as QueueRow[];
  const userCount = userUnion.count ?? 0;
  const userPendingSetRequested = userUnion.debug?.pendingSetRequested ?? null;
  const userPendingSetSanitized = userUnion.debug?.pendingSetSanitized ?? null;
  const userDroppedStatuses = userUnion.debug?.droppedStatuses ?? null;

  let note = "ok";
  const serviceKeyPresent = hasServiceRoleEnv();
  let serviceCount: number | null = serviceKeyPresent ? 0 : null;
  let serviceSample: { id: string; status: string | null; updated_at: string | null }[] = [];
  let serviceBranchAttempted = false;
  let serviceError: { name: string; message: string; details?: string; hint?: string; code?: string } | null = null;
  let serviceStatus: number | null = null;
  let serviceQueryDebug: Record<string, unknown> | null = null;
  const rawPostgrestPing: { attempted: boolean; status: number | null; ok: boolean; error: unknown } = {
    attempted: false,
    status: null,
    ok: false,
    error: null,
  };
  const rawQueueFetch: {
    attempted: boolean;
    status: number | null;
    ok: boolean;
    contentType: string | null;
    bodySnippet: string | null;
    urlUsed: string | null;
    acceptProfile: boolean;
  }[] = [];
  const rawSimpleFetch: {
    status: number | null;
    ok: boolean;
    contentType: string | null;
    bodySnippet: string | null;
    urlUsed: string | null;
    acceptProfile: boolean;
  }[] = [];
  if (auth.role === "admin" && serviceKeyPresent) {
    serviceBranchAttempted = true;
    try {
      const service = createServiceRoleClient();
      const serviceUnion = await fetchReviewableUnion(service, ADMIN_REVIEW_QUEUE_SELECT);
      serviceStatus = serviceUnion.debug.queryAStatus ?? serviceUnion.debug.queryBStatus ?? null;
      const srRows: QueueRow[] = (serviceUnion.data ?? []) as QueueRow[];
      const srCount = serviceUnion.count ?? 0;
      serviceCount = srCount;
      serviceSample = srRows.map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at ?? null }));
      serviceQueryDebug = {
        queryAStatus: serviceUnion.debug.queryAStatus,
        queryBStatus: serviceUnion.debug.queryBStatus,
        queryAError: serviceUnion.debug.queryAError,
        queryBError: serviceUnion.debug.queryBError,
        queryACount: serviceUnion.debug.queryACount,
        queryBCount: serviceUnion.debug.queryBCount,
        pendingSetRequested: serviceUnion.debug.pendingSetRequested,
        pendingSetSanitized: serviceUnion.debug.pendingSetSanitized,
        droppedStatuses: serviceUnion.debug.droppedStatuses,
      };
      if (userCount === 0 && srCount > 0) {
        note = "RLS or role may be blocking admin query";
      }
      // Raw PostgREST ping
      if (normalizedUrl) {
        rawPostgrestPing.attempted = true;
        try {
          const resp = await fetch(`${normalizedUrl}/rest/v1/properties?select=id&limit=1`, {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "count=exact",
            },
          });
          rawPostgrestPing.status = resp.status;
          rawPostgrestPing.ok = resp.ok;
          if (!resp.ok) {
            rawPostgrestPing.error = await resp.text();
          }
        } catch (pingErr) {
          rawPostgrestPing.status = null;
          rawPostgrestPing.ok = false;
          rawPostgrestPing.error = (pingErr as Error)?.message || "ping failed";
        }
        // Raw queue fetch with and without Accept-Profile
        const queueUrl = `${normalizedUrl}/rest/v1/properties?select=${encodeURIComponent(ADMIN_REVIEW_QUEUE_SELECT)}`;
        for (const acceptProfile of [true, false]) {
          const headers = {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Accept: "application/json",
          } as Record<string, string>;
          if (acceptProfile) headers["Accept-Profile"] = "public";
          try {
            const resp = await fetch(queueUrl, { headers });
            const contentType = resp.headers.get("content-type");
            const body = await resp.text();
            rawQueueFetch.push({
              attempted: true,
              status: resp.status,
              ok: resp.ok,
              contentType,
              bodySnippet: body.slice(0, 500),
              urlUsed: queueUrl,
              acceptProfile,
            });
          } catch (errFetch) {
            rawQueueFetch.push({
              attempted: true,
              status: null,
              ok: false,
              contentType: null,
              bodySnippet: (errFetch as Error)?.message?.slice(0, 500) || "fetch failed",
              urlUsed: queueUrl,
              acceptProfile,
            });
          }
        }
        // Raw simple select
        const simpleUrl = `${normalizedUrl}/rest/v1/properties?select=${encodeURIComponent(ADMIN_REVIEW_QUEUE_SELECT)}&limit=1`;
        for (const acceptProfile of [true, false]) {
          const headers = {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Accept: "application/json",
          } as Record<string, string>;
          if (acceptProfile) headers["Accept-Profile"] = "public";
          try {
            const resp = await fetch(simpleUrl, { headers });
            const contentType = resp.headers.get("content-type");
            const body = await resp.text();
            rawSimpleFetch.push({
              status: resp.status,
              ok: resp.ok,
              contentType,
              bodySnippet: body.slice(0, 500),
              urlUsed: simpleUrl,
              acceptProfile,
            });
          } catch (errSimple) {
            rawSimpleFetch.push({
              status: null,
              ok: false,
              contentType: null,
              bodySnippet: (errSimple as Error)?.message?.slice(0, 500) || "fetch failed",
              urlUsed: simpleUrl,
              acceptProfile,
            });
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string; details?: string; hint?: string; code?: string };
      serviceError = {
        name: e?.name || "Error",
        message: e?.message || "service role query failed",
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
      };
      note = "service role check failed";
      serviceCount = 0;
    }
  } else if (userCount === 0) {
    note = "service role unavailable; cannot confirm if rows exist";
  }

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
    const matchedStatus = normalized ? PENDING_STATUS_LIST.includes(normalized) : false;
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
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    },
    viewer: { userId: auth.user.id, role: "admin" },
    pending: {
      statusSetUsed: pendingStatuses,
      pendingSetRequested: userPendingSetRequested,
      pendingSetSanitized: userPendingSetSanitized,
      droppedStatuses: userDroppedStatuses,
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
      serviceQueryDebug,
      rawPostgrestPing,
      rawQueueFetch,
      rawSimpleFetch,
      serviceQueryAStatus: (serviceQueryDebug as { queryAStatus?: number | null })?.queryAStatus ?? null,
      serviceQueryBStatus: (serviceQueryDebug as { queryBStatus?: number | null })?.queryBStatus ?? null,
      serviceQueryAError: (serviceQueryDebug as { queryAError?: unknown })?.queryAError ?? null,
      serviceQueryBError: (serviceQueryDebug as { queryBError?: unknown })?.queryBError ?? null,
      serviceQueryACount: (serviceQueryDebug as { queryACount?: number })?.queryACount ?? null,
      serviceQueryBCount: (serviceQueryDebug as { queryBCount?: number })?.queryBCount ?? null,
      mergedCount: serviceSample.length || userCount,
      servicePendingSetRequested: (serviceQueryDebug as { pendingSetRequested?: unknown })?.pendingSetRequested ?? null,
      servicePendingSetSanitized: (serviceQueryDebug as { pendingSetSanitized?: unknown })?.pendingSetSanitized ?? null,
      serviceDroppedStatuses: (serviceQueryDebug as { droppedStatuses?: unknown })?.droppedStatuses ?? null,
      reviewableOrClauseUsed: null,
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
