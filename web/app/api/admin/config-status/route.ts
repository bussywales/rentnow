import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { getOperatorMonitoringSnapshot, type MonitoringClient } from "@/lib/monitoring/operator-status";

type ConfigStatusDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  getUserRole: typeof getUserRole;
  getOperatorMonitoringSnapshot: (
    client: MonitoringClient,
    env?: NodeJS.ProcessEnv
  ) => ReturnType<typeof getOperatorMonitoringSnapshot>;
};

const defaultDeps: ConfigStatusDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  getUserRole,
  getOperatorMonitoringSnapshot,
};

export async function getConfigStatusResponse(deps: ConfigStatusDeps = defaultDeps) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const role = normalizeRole(await deps.getUserRole(supabase, user.id));
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "enable_location_picker",
      "require_location_pin_for_publish",
      "show_tenant_checkin_badge",
    ]);

  const parseFlag = (key: string) =>
    parseAppSettingBool(data?.find((row) => row.key === key)?.value, false);

  const monitoring = await deps.getOperatorMonitoringSnapshot(
    supabase as unknown as MonitoringClient,
    process.env
  );

  return NextResponse.json({
    ok: true,
    flags: {
      enable_location_picker: parseFlag("enable_location_picker"),
      require_location_pin_for_publish: parseFlag("require_location_pin_for_publish"),
      show_tenant_checkin_badge: parseFlag("show_tenant_checkin_badge"),
    },
    env: {
      runtimeEnvironment: monitoring.runtimeEnvironment,
      mapboxServerConfigured: !!process.env.MAPBOX_TOKEN,
      mapboxClientConfigured: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      sentryServerConfigured: !!process.env.SENTRY_DSN,
      sentryClientConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      sentryReleaseConfigured:
        !!process.env.SENTRY_RELEASE ||
        !!process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
        !!process.env.VERCEL_GIT_COMMIT_SHA ||
        !!process.env.COMMIT_SHA,
      commitSha: monitoring.commitSha,
    },
    schema: {
      ready: monitoring.schema.ready,
      checkedAt: monitoring.schema.checkedAt,
      checkedCount: monitoring.schema.checkedCount,
      missingColumns: monitoring.schema.missing.map((item) => `${item.table}.${item.column}`),
      queryError: monitoring.schema.queryError,
    },
    monitoring,
  });
}

export async function GET() {
  return getConfigStatusResponse(defaultDeps);
}
