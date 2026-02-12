import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { runSavedSearchEmailAlerts } from "@/lib/saved-searches/alerts-email.server";
import type { SavedSearchAlertsRunResult } from "@/lib/saved-searches/alerts.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";

const routeLabel = "/api/admin/alerts/run";
const MAX_ERRORS = 10;

export type AdminAlertsRunDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  dispatchSavedSearchEmailAlerts: (input?: {
    limit?: number;
    now?: Date;
  }) => Promise<SavedSearchAlertsRunResult>;
  getCronSecret: () => string;
  getNow: () => Date;
};

const defaultDeps: AdminAlertsRunDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  dispatchSavedSearchEmailAlerts: runSavedSearchEmailAlerts,
  getCronSecret: () => process.env.CRON_SECRET || "",
  getNow: () => new Date(),
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

type AlertsLastRunStatusPayload = {
  ran_at_utc: string;
  mode: "cron" | "admin";
  users_processed: number;
  digests_sent: number;
  searches_included: number;
  failed_users: number;
  disabled_reason: null | "kill_switch" | "feature_flag_off";
};

type UntypedAdminClient = {
  from: (
    table: string
  ) => {
    upsert: (values: unknown, options?: { onConflict?: string }) => Promise<unknown>;
  };
};

async function saveAlertsLastRunStatus(
  deps: AdminAlertsRunDeps,
  payload: AlertsLastRunStatusPayload
) {
  if (!deps.hasServiceRoleEnv()) return;
  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  await adminClient
    .from("app_settings")
    .upsert(
      {
        key: APP_SETTING_KEYS.alertsLastRunStatusJson,
        value: payload,
        updated_at: payload.ran_at_utc,
      },
      { onConflict: "key" }
    );
}

export async function postAdminAlertsRunResponse(
  request: NextRequest,
  deps: AdminAlertsRunDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const secretOk = hasValidCronSecret(request, deps.getCronSecret());
  if (!secretOk) {
    const auth = await deps.requireRole({
      request,
      route: routeLabel,
      startTime,
      roles: ["admin"],
    });
    if (!auth.ok) return auth.response;
  }

  const mode: "cron" | "admin" = secretOk ? "cron" : "admin";
  const ranAt = deps.getNow().toISOString();

  try {
    const result = await deps.dispatchSavedSearchEmailAlerts();
    await saveAlertsLastRunStatus(deps, {
      ran_at_utc: ranAt,
      mode,
      users_processed: result.processedUsers,
      digests_sent: result.emailsSent,
      searches_included: result.sent,
      failed_users: result.failedUsers ?? 0,
      disabled_reason: result.disabledReason ?? null,
    });
    const errors =
      result.failed > 0 ? [`${result.failed} saved-search alert delivery attempts failed.`] : [];
    return NextResponse.json(
      {
        ok: result.ok,
        users_processed: result.processedUsers,
        emails_sent: result.emailsSent,
        digests_sent: result.emailsSent,
        searches_processed: result.processed,
        searches_included: result.sent,
        search_alerts_sent: result.sent,
        duplicates: result.duplicates,
        no_matches: result.noMatches,
        skipped: result.skipped,
        failed_users: result.failedUsers ?? 0,
        disabled_reason: result.disabledReason ?? null,
        errors: errors.slice(0, MAX_ERRORS),
      },
      { status: result.ok ? 200 : 503 }
    );
  } catch (error) {
    await saveAlertsLastRunStatus(deps, {
      ran_at_utc: ranAt,
      mode,
      users_processed: 0,
      digests_sent: 0,
      searches_included: 0,
      failed_users: 0,
      disabled_reason: null,
    });
    const message = error instanceof Error ? error.message : "Unable to run alerts";
    return NextResponse.json(
      { ok: false, users_processed: 0, emails_sent: 0, errors: [message] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postAdminAlertsRunResponse(request);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
