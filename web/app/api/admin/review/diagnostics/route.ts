import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import {
  applyReviewableFilters,
  buildReviewableOrClause,
  getStatusesForView,
  isReviewableRow,
} from "@/lib/admin/admin-review-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
    .or(orFilter)
    .order("updated_at", { ascending: false })
    .limit(5);
  const userResult = await userQuery;
  const rows: QueueRow[] = (userResult.data ?? []) as QueueRow[];
  const count = userResult.count;

  let note = "ok";
  let serviceCount: number | null = null;
  let serviceSample: { id: string; status: string | null; updated_at: string | null }[] = [];
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceRoleClient();
      const serviceQuery = applyReviewableFilters(
        service
          .from("properties")
          .select("id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active", { count: "exact" })
      )
        .or(orFilter)
        .order("updated_at", { ascending: false })
        .limit(5);
      const srResult = await serviceQuery;
      const srRows: QueueRow[] = (srResult.data ?? []) as QueueRow[];
      const srCount = srResult.count;
      serviceCount = srCount ?? null;
      serviceSample = srRows.map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at ?? null }));
      if ((count ?? 0) === 0 && (srCount ?? 0) > 0) {
        note = "RLS or role may be blocking admin query";
      }
    } catch {
      note = "service role check failed";
    }
  } else if ((count ?? 0) === 0) {
    note = "service role unavailable; cannot confirm if rows exist";
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = (() => {
    try {
      const u = new URL(supabaseUrl);
      return u.hostname;
    } catch {
      return "unknown";
    }
  })();

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

  const rlsSuspected = (count ?? 0) === 0 && (serviceCount ?? 0) > 0;

  return NextResponse.json({
    env: { supabase: projectRef, nodeEnv: process.env.NODE_ENV },
    viewer: { userId: auth.user.id, role: "admin" },
    pending: {
      statusSetUsed: pendingStatuses,
      count: count ?? 0,
      sample: (rows ?? []).map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at })),
      serviceCount,
      serviceSample,
      statusCounts,
      activeCounts,
      rlsSuspected,
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
  });
}
