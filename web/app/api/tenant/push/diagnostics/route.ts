import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  hasServiceRoleEnv,
} from "@/lib/supabase/admin";
import { fetchTenantPushDiagnostics } from "@/lib/tenant/push-diagnostics";

const routeLabel = "/api/tenant/push/diagnostics";

type DiagnosticsDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireRole?: typeof requireRole;
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
  fetchTenantPushDiagnostics?: typeof fetchTenantPushDiagnostics;
  logFailure?: typeof logFailure;
};

export async function getTenantPushDiagnosticsResponse(
  request: Request,
  deps: DiagnosticsDeps = {}
) {
  const startTime = Date.now();
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const requireRoleFn = deps.requireRole ?? requireRole;
  const hasServiceRoleEnvFn = deps.hasServiceRoleEnv ?? hasServiceRoleEnv;
  const createServiceRoleClientFn =
    deps.createServiceRoleClient ?? createServiceRoleClient;
  const fetchDiagnostics = deps.fetchTenantPushDiagnostics ?? fetchTenantPushDiagnostics;
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

  const adminDb = hasServiceRoleEnvFn() ? createServiceRoleClientFn() : null;

  try {
    const diagnostics = await fetchDiagnostics({
      supabase: auth.supabase,
      adminDb,
      userId: auth.user.id,
    });
    return NextResponse.json({ ok: true, diagnostics });
  } catch (error) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error : "diagnostics_failed",
    });
    return NextResponse.json(
      { ok: false, error: "Unable to load push diagnostics." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return getTenantPushDiagnosticsResponse(request);
}
