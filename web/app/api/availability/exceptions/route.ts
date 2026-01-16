import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeExceptionInput } from "@/lib/availability/host";
import { logAuditEvent } from "@/lib/audit/audit-log";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/availability/exceptions";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  type: z.enum(["blackout", "add_window"]),
  windows: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
});

export async function POST(request: Request) {
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

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    logAuditEvent("availability.exceptions.create", {
      route: routeLabel,
      actorId: auth.user.id,
      outcome: "deny",
      reason: "validation_failed",
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", body.propertyId)
    .maybeSingle();

  if (propertyError || !property) {
    logAuditEvent("availability.exceptions.create", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "deny",
      reason: "not_found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (property.owner_id !== auth.user.id && auth.role !== "admin") {
    logAuditEvent("availability.exceptions.create", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "deny",
      reason: "not_owner",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = normalizeExceptionInput({
      propertyId: body.propertyId,
      date: body.date,
      type: body.type,
      windows: body.windows,
    }).map((ex) => ({
      property_id: body.propertyId,
      local_date: ex.local_date,
      exception_type: ex.exception_type,
      start_minute: ex.start_minute,
      end_minute: ex.end_minute,
    }));
    const { error } = await supabase.from("property_availability_exceptions").insert(rows);
    if (error) throw error;

    logAuditEvent("availability.exceptions.create", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "ok",
      meta: { exceptionsCount: rows.length },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: err,
    });
    logAuditEvent("availability.exceptions.create", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "error",
      reason: "db_error",
    });
    return NextResponse.json({ error: "Unable to save exception" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const date = searchParams.get("date");
  const type = searchParams.get("type");
  if (!propertyId || !date || !type) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: property } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) {
    logAuditEvent("availability.exceptions.delete", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId,
      outcome: "deny",
      reason: "not_found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (property.owner_id !== auth.user.id && auth.role !== "admin") {
    logAuditEvent("availability.exceptions.delete", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId,
      outcome: "deny",
      reason: "not_owner",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("property_availability_exceptions")
    .delete()
    .eq("property_id", propertyId)
    .eq("local_date", date)
    .eq("exception_type", type);

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error,
    });
    logAuditEvent("availability.exceptions.delete", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId,
      outcome: "error",
      reason: "db_error",
    });
    return NextResponse.json({ error: "Unable to delete exception" }, { status: 400 });
  }

  logAuditEvent("availability.exceptions.delete", {
    route: routeLabel,
    actorId: auth.user.id,
    propertyId,
    outcome: "ok",
  });
  return NextResponse.json({ ok: true });
}
