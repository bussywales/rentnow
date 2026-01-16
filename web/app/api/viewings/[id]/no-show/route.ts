import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { logAuditEvent } from "@/lib/audit/audit-log";

const routeLabel = "/api/viewings/:id/no-show";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type ViewingRow = {
  id: string;
  property_id: string;
  status: string;
  no_show_reported_at?: string | null;
  properties?: { owner_id?: string | null } | null;
};

export function canMarkNoShow(row: ViewingRow, actorId: string, actorIsAdmin: boolean) {
  if (!row) throw new Error("not_found");
  const ownerId = row.properties?.owner_id;
  if (ownerId !== actorId && !actorIsAdmin) throw new Error("not_owner");
  if (row.status !== "approved") throw new Error("not_approved");
  if (row.no_show_reported_at) throw new Error("already_marked");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request: _request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = await createServerSupabaseClient();
  const { id } = paramsSchema.parse(await context.params);

  const { data: row, error } = await supabase
    .from("viewing_requests")
    .select("id, property_id, status, no_show_reported_at, properties:properties!inner(owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Viewing request not found" }, { status: 404 });
  }

  try {
    canMarkNoShow(row as ViewingRow, auth.user.id, auth.role === "admin");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "not_owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg === "not_approved") return NextResponse.json({ error: "Only approved viewings can be marked no-show" }, { status: 400 });
    if (msg === "already_marked") return NextResponse.json({ error: "No-show already reported" }, { status: 409 });
    return NextResponse.json({ error: "Viewing request not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("viewing_requests")
    .update({
      no_show_reported_at: new Date().toISOString(),
      no_show_reported_by: auth.user.id,
    })
    .eq("id", id);

  if (updateError) {
    logFailure({
      request: _request,
      route: routeLabel,
      status: 400,
      startTime,
      error: updateError,
    });
    return NextResponse.json({ error: "Unable to mark no-show" }, { status: 400 });
  }

  logAuditEvent("viewing_no_show_marked", {
    route: routeLabel,
    actorId: auth.user.id,
    propertyId: row.property_id,
    outcome: "ok",
    meta: { viewingRequestId: row.id },
  });

  return NextResponse.json({ ok: true });
}
