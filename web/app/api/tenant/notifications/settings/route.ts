import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import {
  normalizeNotificationTimezone,
  normalizeQuietHoursInput,
  normalizeSavedSearchPushMode,
  normalizeTenantNotificationPrefs,
  toTenantNotificationSettingsPayload,
  type TenantNotificationPrefsRow,
} from "@/lib/notifications/settings";

const routeLabel = "/api/tenant/notifications/settings";

const settingsSchema = z.object({
  savedSearchPushEnabled: z.boolean(),
  savedSearchPushMode: z.enum(["instant", "daily"]),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  timezone: z.string().min(1).max(120),
});

type NotificationSettingsDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireRole?: typeof requireRole;
  logFailure?: typeof logFailure;
};

async function loadCountryCode(supabase: unknown, userId: string) {
  const lookup = supabase as {
    from: (table: "profiles") => {
      select: (columns: "country_code") => {
        eq: (column: "id", value: string) => {
          maybeSingle: () => Promise<{ data: { country_code?: unknown } | null }>;
        };
      };
    };
  };

  const { data } = await lookup
    .from("profiles")
    .select("country_code")
    .eq("id", userId)
    .maybeSingle();

  if (!data || typeof (data as { country_code?: unknown }).country_code !== "string") {
    return null;
  }

  return ((data as { country_code: string }).country_code || "").toUpperCase();
}

export async function getTenantNotificationSettingsResponse(
  request: Request,
  deps: NotificationSettingsDeps = {}
) {
  const startTime = Date.now();
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const requireRoleFn = deps.requireRole ?? requireRole;
  const logFailureFn = deps.logFailure ?? logFailure;

  if (!hasEnv()) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  const countryCode = await loadCountryCode(auth.supabase, auth.user.id);

  const { data, error } = await auth.supabase
    .from("tenant_notification_prefs")
    .select(
      "profile_id,saved_search_push_enabled,saved_search_push_mode,quiet_hours_start,quiet_hours_end,timezone,last_saved_search_push_at,created_at,updated_at"
    )
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (error) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to load notification settings." },
      { status: 500 }
    );
  }

  const prefs = normalizeTenantNotificationPrefs({
    profileId: auth.user.id,
    countryCode,
    row: (data as TenantNotificationPrefsRow | null) ?? null,
  });

  return NextResponse.json({
    ok: true,
    settings: toTenantNotificationSettingsPayload(prefs),
  });
}

export async function putTenantNotificationSettingsResponse(
  request: Request,
  deps: NotificationSettingsDeps = {}
) {
  const startTime = Date.now();
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const requireRoleFn = deps.requireRole ?? requireRole;
  const logFailureFn = deps.logFailure ?? logFailure;

  if (!hasEnv()) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid notification settings payload." },
      { status: 400 }
    );
  }

  const quiet = normalizeQuietHoursInput({
    quietHoursStart: parsed.data.quietHoursStart ?? null,
    quietHoursEnd: parsed.data.quietHoursEnd ?? null,
  });

  const payload = {
    profile_id: auth.user.id,
    saved_search_push_enabled: parsed.data.savedSearchPushEnabled,
    saved_search_push_mode: normalizeSavedSearchPushMode(parsed.data.savedSearchPushMode),
    quiet_hours_start: quiet.quietHoursStart,
    quiet_hours_end: quiet.quietHoursEnd,
    timezone: normalizeNotificationTimezone(parsed.data.timezone),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("tenant_notification_prefs")
    .upsert(payload, { onConflict: "profile_id" })
    .select(
      "profile_id,saved_search_push_enabled,saved_search_push_mode,quiet_hours_start,quiet_hours_end,timezone,last_saved_search_push_at,created_at,updated_at"
    )
    .single();

  if (error) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to save notification settings." },
      { status: 500 }
    );
  }

  const prefs = normalizeTenantNotificationPrefs({
    profileId: auth.user.id,
    row: data as TenantNotificationPrefsRow,
  });

  return NextResponse.json({
    ok: true,
    settings: toTenantNotificationSettingsPayload(prefs),
  });
}

export async function GET(request: Request) {
  return getTenantNotificationSettingsResponse(request);
}

export async function PUT(request: Request) {
  return putTenantNotificationSettingsResponse(request);
}
