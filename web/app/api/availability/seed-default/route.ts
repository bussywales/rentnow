import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { defaultTemplateRules, normalizeRuleInput } from "@/lib/availability/host";
import { logAuditEvent } from "@/lib/audit/audit-log";

const routeLabel = "/api/availability/seed-default";

const bodySchema = z.object({
  propertyId: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime: Date.now(),
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    logAuditEvent("availability.seed_default", {
      route: routeLabel,
      actorId: auth.user.id,
      outcome: "deny",
      reason: "validation_failed",
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rules = normalizeRuleInput(defaultTemplateRules());
  const insertRows = rules.map((r) => ({
    property_id: body.propertyId,
    day_of_week: r.day_of_week,
    start_minute: r.start_minute,
    end_minute: r.end_minute,
  }));

  // Reuse rules endpoint via fetch to avoid code duplication
  const res = await fetch(new URL("/api/availability/rules", request.url), {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({
      propertyId: body.propertyId,
      slotLengthMinutes: 30,
      rules: defaultTemplateRules(),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    logAuditEvent("availability.seed_default", {
      route: routeLabel,
      actorId: auth.user.id,
      propertyId: body.propertyId,
      outcome: "error",
      reason: "rules_seed_failed",
      meta: { status: res.status },
    });
    return NextResponse.json({ error: "Unable to seed default schedule" }, { status: 400 });
  }

  logAuditEvent("availability.seed_default", {
    route: routeLabel,
    actorId: auth.user.id,
    propertyId: body.propertyId,
    outcome: "ok",
    meta: { rulesCount: insertRows.length },
  });
  return NextResponse.json({ ok: true });
}
