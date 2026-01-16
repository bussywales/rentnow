import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { deriveReliability } from "@/lib/viewings/reliability";

const routeLabel = "/api/viewings/host";

export async function GET(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("viewing_requests")
      .select(
        "id, property_id, tenant_id, status, preferred_times, approved_time, proposed_times, host_message, decline_reason_code, message, created_at, decided_at, no_show_reported_at, properties!inner(id, owner_id, title, city, neighbourhood, timezone)"
      )
      .order("created_at", { ascending: false });

    const rows =
      ((data || []) as Array<{
        properties?: { owner_id?: string | null };
        tenant_id?: string;
      }>).filter(
        (row) =>
          row.properties?.owner_id === auth.user.id || auth.role === "admin"
      ) || [];

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: "Unable to load viewings" }, { status: 400 });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean)));

    let reliabilityMap: Record<string, { noShowCount90d: number; completedCount90d: number; label: string }> =
      {};

    if (tenantIds.length) {
      const { data: relData } = await supabase
        .from("viewing_requests")
        .select("tenant_id, status, no_show_reported_at, created_at")
        .in("tenant_id", tenantIds)
        .gte("created_at", ninetyDaysAgo.toISOString());

      reliabilityMap = (relData || []).reduce((acc, row) => {
        const tid = row.tenant_id as string;
        const current = acc[tid] || { noShowCount90d: 0, completedCount90d: 0, label: "Unknown" };
        if (row.no_show_reported_at) current.noShowCount90d += 1;
        if (row.status === "completed") current.completedCount90d += 1;
        acc[tid] = current;
        return acc;
      }, {} as Record<string, { noShowCount90d: number; completedCount90d: number; label: string }>);

      Object.keys(reliabilityMap).forEach((tid) => {
        const item = reliabilityMap[tid];
        const snap = deriveReliability(item.noShowCount90d, item.completedCount90d);
        item.label = snap.label;
      });
    }

    const viewings = rows.map((row) => ({
      ...row,
      tenantReliability: row.tenant_id
        ? reliabilityMap[row.tenant_id] || deriveReliability(0, 0)
        : undefined,
    }));

    return NextResponse.json({
      ok: true,
      viewings,
      items: viewings,
    });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: "Unable to load viewings" }, { status: 500 });
  }
}
