import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { dispatchSavedSearchEmailAlerts } from "@/lib/saved-searches/alerts.server";

const routeLabel = "/api/jobs/saved-search-alerts";

export type SavedSearchAlertsJobDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  dispatchSavedSearchEmailAlerts: typeof dispatchSavedSearchEmailAlerts;
  getJobSecret: () => string;
};

const defaultDeps: SavedSearchAlertsJobDeps = {
  hasServerSupabaseEnv,
  requireRole,
  dispatchSavedSearchEmailAlerts,
  getJobSecret: () => process.env.JOB_SECRET || "",
};

function hasValidSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-job-secret") === expected;
}

export async function postSavedSearchAlertsJobResponse(
  request: NextRequest,
  deps: SavedSearchAlertsJobDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const secretOk = hasValidSecret(request, deps.getJobSecret());
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
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run saved search alerts job";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postSavedSearchAlertsJobResponse(request);
}

