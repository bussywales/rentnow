import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { resolveInsightsRange } from "@/lib/admin/insights";
import { buildMonetisationOpportunities } from "@/lib/admin/monetisation-opportunities.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/insights/monetisation-opportunities";

export type AdminMonetisationDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  buildMonetisationOpportunities: typeof buildMonetisationOpportunities;
};

const defaultDeps: AdminMonetisationDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  buildMonetisationOpportunities,
};

export async function getAdminMonetisationResponse(
  request: NextRequest,
  deps: AdminMonetisationDeps = defaultDeps
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
  const market = request.nextUrl.searchParams.get("market");

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  try {
    const opportunities = await deps.buildMonetisationOpportunities({
      client,
      range,
      market,
    });
    return NextResponse.json({ opportunities });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to load monetisation opportunities" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminMonetisationResponse(request);
}
