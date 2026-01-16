import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { logAuditEvent } from "@/lib/audit/audit-log";

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
    const { data, error } = await auth.supabase
      .from("viewing_requests")
      .select(
        "id, property_id, tenant_id, status, preferred_times, approved_time, proposed_times, host_message, decline_reason_code, message, created_at, decided_at, properties!inner(id, owner_id, title, city, neighbourhood, timezone)"
      )
      .order("created_at", { ascending: false });

    const rows =
      ((data || []) as Array<{
        properties?: { owner_id?: string | null };
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

    logAuditEvent("viewings.host.inbox", {
      route: routeLabel,
      actorId: auth.user.id,
      outcome: "ok",
      meta: { count: rows.length },
    });

    return NextResponse.json({ ok: true, viewings: rows });
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
