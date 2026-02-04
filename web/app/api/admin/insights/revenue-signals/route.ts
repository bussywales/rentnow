import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { resolveInsightsRange } from "@/lib/admin/insights";
import { buildRevenueSignals } from "@/lib/admin/revenue-signals.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/insights/revenue-signals";

export type AdminRevenueSignalsDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  buildRevenueSignals: typeof buildRevenueSignals;
};

const defaultDeps: AdminRevenueSignalsDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  buildRevenueSignals,
};

export async function getAdminRevenueSignalsResponse(
  request: NextRequest,
  deps: AdminRevenueSignalsDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const range = resolveInsightsRange(request.nextUrl.searchParams.get("range"));
  const adminClient = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : null;
  const client = adminClient ?? auth.supabase;

  try {
    const readiness = await deps.buildRevenueSignals({ client, range });
    return NextResponse.json({ readiness });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to load revenue signals" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminRevenueSignalsResponse(request);
}
