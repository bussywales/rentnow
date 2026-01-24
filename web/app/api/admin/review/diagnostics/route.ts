import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import { buildStatusOrFilter, getStatusesForView } from "@/lib/admin/admin-review-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  const orFilter = buildStatusOrFilter("pending");

  const { data: rows, count } = await supabase
    .from("properties")
    .select("id,status,updated_at", { count: "exact" })
    .or(orFilter)
    .order("updated_at", { ascending: false })
    .limit(5);

  let note = "ok";
  let serviceCount: number | null = null;
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceRoleClient();
      const { count: srCount } = await service
        .from("properties")
        .select("id", { count: "exact", head: true })
        .or(orFilter);
      serviceCount = srCount ?? null;
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

  return NextResponse.json({
    env: { supabase: projectRef, nodeEnv: process.env.NODE_ENV },
    viewer: { userId: auth.user.id, role: "admin" },
    pending: {
      statusSetUsed: pendingStatuses,
      count: count ?? 0,
      sample: (rows ?? []).map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at })),
      serviceCount,
    },
    notes: note,
  });
}
