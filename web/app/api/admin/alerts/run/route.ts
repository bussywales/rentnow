import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { runSavedSearchEmailAlerts } from "@/lib/saved-searches/alerts-email.server";
import type { SavedSearchAlertsRunResult } from "@/lib/saved-searches/alerts.server";

const routeLabel = "/api/admin/alerts/run";
const MAX_ERRORS = 10;

export type AdminAlertsRunDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  dispatchSavedSearchEmailAlerts: (input?: {
    limit?: number;
    now?: Date;
  }) => Promise<SavedSearchAlertsRunResult>;
  getCronSecret: () => string;
};

const defaultDeps: AdminAlertsRunDeps = {
  hasServerSupabaseEnv,
  requireRole,
  dispatchSavedSearchEmailAlerts: runSavedSearchEmailAlerts,
  getCronSecret: () => process.env.CRON_SECRET || "",
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
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

  try {
    const result = await deps.dispatchSavedSearchEmailAlerts();
    const errors =
      result.failed > 0 ? [`${result.failed} saved-search alert delivery attempts failed.`] : [];
    return NextResponse.json(
      {
        ok: result.ok,
        users_processed: result.processedUsers,
        emails_sent: result.emailsSent,
        searches_processed: result.processed,
        search_alerts_sent: result.sent,
        duplicates: result.duplicates,
        no_matches: result.noMatches,
        skipped: result.skipped,
        errors: errors.slice(0, MAX_ERRORS),
      },
      { status: result.ok ? 200 : 503 }
    );
  } catch (error) {
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
