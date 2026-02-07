import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logAuditEvent } from "@/lib/audit/audit-log";
import {
  APP_SETTING_KEY_LIST,
  APP_SETTING_KEYS,
  type AppSettingKey,
} from "@/lib/settings/app-settings-keys";

const ALLOWED_KEYS = APP_SETTING_KEY_LIST as [AppSettingKey, ...AppSettingKey[]];
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

const numericValueSchema = z.object({
  value: z.number().int().min(0).max(1_000_000),
});

export const patchSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.union([enabledValueSchema, modeValueSchema, daysValueSchema, numericValueSchema]),
});

export function validatePatchPayload(input: unknown) {
  const parsed = patchSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }
  return { ok: false as const, error: parsed.error };
}

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

  const parsed = validatePatchPayload(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  const body = parsed.data;
  const isModeSetting = body.key === APP_SETTING_KEYS.contactExchangeMode;
  const isExpirySetting = body.key === APP_SETTING_KEYS.listingExpiryDays;
  const isNumericSetting =
    body.key === APP_SETTING_KEYS.paygListingFeeAmount ||
    body.key === APP_SETTING_KEYS.trialListingCreditsAgent ||
    body.key === APP_SETTING_KEYS.trialListingCreditsLandlord;
  if (isModeSetting && !("mode" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  if (isExpirySetting && !("days" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  if (isNumericSetting && !("value" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  if (!isModeSetting && !isExpirySetting && !isNumericSetting && !("enabled" in body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("app_settings")
    .upsert({ key: body.key, value: body.value, updated_at: now }, { onConflict: "key" })
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
