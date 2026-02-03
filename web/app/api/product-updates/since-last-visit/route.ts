import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { fetchProductUpdatesSinceLastVisit } from "@/lib/product-updates/product-updates.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates/since-last-visit";

export type SinceLastVisitDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  fetchProductUpdatesSinceLastVisit: typeof fetchProductUpdatesSinceLastVisit;
  logFailure: typeof logFailure;
};

const defaultDeps: SinceLastVisitDeps = {
  hasServerSupabaseEnv,
  requireUser,
  getUserRole,
  fetchProductUpdatesSinceLastVisit,
  logFailure,
};

export async function getSinceLastVisitResponse(
  request: Request,
  deps: SinceLastVisitDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const role = await deps.getUserRole(auth.supabase, auth.user.id);
    const result = await deps.fetchProductUpdatesSinceLastVisit({
      client: auth.supabase,
      role,
      userId: auth.user.id,
      limit: 3,
    });

    return NextResponse.json({
      since: result.since,
      count_new_since_last_visit: result.count,
      latest: result.latest,
    });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "since last visit fetch failed",
    });
    return NextResponse.json({ error: "Unable to load updates" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getSinceLastVisitResponse(request);
}
