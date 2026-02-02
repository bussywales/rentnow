import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logAuditEvent } from "@/lib/audit/audit-log";

const ALLOWED_KEYS = [
  "show_tenant_photo_trust_signals",
  "enable_location_picker",
  "show_tenant_checkin_badge",
  "require_location_pin_for_publish",
  "contact_exchange_mode",
  "listing_expiry_days",
  "show_expired_listings_public",
] as const;
const routeLabel = "/api/admin/app-settings";

const enabledValueSchema = z.object({
  enabled: z.boolean(),
});

const modeValueSchema = z.object({
  mode: z.enum(["off", "redact", "block"]),
});

const daysValueSchema = z.object({
  days: z.number().int().min(7).max(365),
});

export const patchSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.union([enabledValueSchema, modeValueSchema, daysValueSchema]),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key || !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return NextResponse.json({ error: "Unsupported key" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  return NextResponse.json({ ok: true, setting: data });
}

export async function PATCH(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = patchSchema.parse(await request.json());
  const isModeSetting = body.key === "contact_exchange_mode";
  const isExpirySetting = body.key === "listing_expiry_days";
  if (isModeSetting && !("mode" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  if (isExpirySetting && !("days" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  if (!isModeSetting && !isExpirySetting && !("enabled" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data, error } = await adminClient
    .from("app_settings")
    .update({ value: body.value, updated_at: new Date().toISOString() })
    .eq("key", body.key)
    .select("key, value, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  logAuditEvent("app_setting_updated", {
    route: routeLabel,
    actorId: auth.user.id,
    outcome: "ok",
    meta: {
      key: body.key,
      value: JSON.stringify(body.value),
    },
  });

  return NextResponse.json({ ok: true, setting: data });
}
