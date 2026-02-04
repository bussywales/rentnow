import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { resolveInsightsRange } from "@/lib/admin/insights";
import { buildRevenueFunnel } from "@/lib/admin/revenue-funnels.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/insights/revenue-funnels";

export type AdminRevenueFunnelsDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  buildRevenueFunnel: typeof buildRevenueFunnel;
};

const defaultDeps: AdminRevenueFunnelsDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  buildRevenueFunnel,
};

export async function getAdminRevenueFunnelsResponse(
  request: NextRequest,
  deps: AdminRevenueFunnelsDeps = defaultDeps
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
  const roleParam = request.nextUrl.searchParams.get("role");
  const role = roleParam === "host" ? "host" : "tenant";
  const intent = request.nextUrl.searchParams.get("intent");
  const market = request.nextUrl.searchParams.get("market");

  const adminClient = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : null;
  const client = adminClient ?? auth.supabase;

  try {
    const funnel = await deps.buildRevenueFunnel({
      client,
      range,
      role,
      intent,
      market,
    });
    return NextResponse.json({ funnel });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to load revenue funnels" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminRevenueFunnelsResponse(request);
}
