import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRuleInput } from "@/lib/availability/host";
import { logAuditEvent } from "@/lib/audit/audit-log";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/availability/rules";

const requestSchema = z.object({
  propertyId: z.string().uuid(),
  slotLengthMinutes: z.number().int().positive().optional(),
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      windows: z.array(
        z.object({
          start: z.string(),
          end: z.string(),
        })
      ),
    })
  ),
});

export async function PUT(request: Request) {
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

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    logAuditEvent("availability.rules.upsert", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: undefined,
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
    logAuditEvent("availability.rules.upsert", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "deny",
      reason: "not_found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (property.owner_id !== auth.user.id && auth.role !== "admin") {
    logAuditEvent("availability.rules.upsert", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "deny",
      reason: "not_owner",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rules = normalizeRuleInput(body.rules.map((r) => ({ dayOfWeek: r.dayOfWeek, windows: r.windows })));
    const { error: delError } = await supabase
      .from("property_availability_rules")
      .delete()
      .eq("property_id", body.propertyId);
    if (delError) throw delError;

    if (rules.length > 0) {
      const insertRows = rules.map((r) => ({
        property_id: body.propertyId,
        day_of_week: r.day_of_week,
        start_minute: r.start_minute,
        end_minute: r.end_minute,
      }));
      const { error: insError } = await supabase.from("property_availability_rules").insert(insertRows);
      if (insError) throw insError;
    }

    logAuditEvent("availability.rules.upsert", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "ok",
      meta: {
        rulesCount: rules.length,
        slotLengthMinutes: body.slotLengthMinutes ?? 30,
      },
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
    logAuditEvent("availability.rules.upsert", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "error",
      reason: "db_error",
    });
    return NextResponse.json({ error: "Unable to save rules" }, { status: 400 });
  }
}
