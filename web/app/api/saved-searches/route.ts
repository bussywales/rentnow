import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure, logSavedSearchLimitHit } from "@/lib/observability";
import { getTenantPlanForTier, isSavedSearchLimitReached } from "@/lib/plans";

const routeLabel = "/api/saved-searches";

const createSchema = z.object({
  name: z.string().min(2),
  query_params: z.record(z.string(), z.unknown()),
});

type SavedSearchDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getTenantPlanForTier: typeof getTenantPlanForTier;
  isSavedSearchLimitReached: typeof isSavedSearchLimitReached;
  logFailure: typeof logFailure;
  logSavedSearchLimitHit: typeof logSavedSearchLimitHit;
};

export async function GET(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; saved searches are unavailable.", searches: [] },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message, searches: [] }, { status: 400 });
  }

  return NextResponse.json({ searches: data || [] });
}

export async function postSavedSearchResponse(
  request: Request,
  deps: Partial<SavedSearchDeps> = {}
) {
  const startTime = Date.now();
  const {
    hasServerSupabaseEnv: hasEnv = hasServerSupabaseEnv,
    createServerSupabaseClient: createClient = createServerSupabaseClient,
    requireUser: requireAuthUser = requireUser,
    getUserRole: getRole = getUserRole,
    getTenantPlanForTier: resolveTenantPlan = getTenantPlanForTier,
    isSavedSearchLimitReached: isLimitReached = isSavedSearchLimitReached,
    logFailure: logError = logFailure,
    logSavedSearchLimitHit: logLimitHit = logSavedSearchLimitHit,
  } = deps;

  if (!hasEnv()) {
    logError({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; saved searches are unavailable." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const auth = await requireAuthUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Please log in to save searches.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  try {
    const role = await getRole(supabase, auth.user.id);
    if (role !== "tenant") {
      logError({
        request,
        route: routeLabel,
        status: 403,
        startTime,
        error: new Error("role_not_allowed"),
      });
      return NextResponse.json(
        { error: "Saved searches are available to tenants.", code: "role_not_allowed" },
        { status: 403 }
      );
    }

    const { data: planRow } = await supabase
      .from("profile_plans")
      .select("plan_tier, valid_until")
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    const validUntil = planRow?.valid_until ?? null;
    const expired =
      !!validUntil && Number.isFinite(Date.parse(validUntil)) && Date.parse(validUntil) < Date.now();
    const tenantPlan = resolveTenantPlan(expired ? "free" : planRow?.plan_tier ?? "free");

    const { count: searchCount, error: countError } = await supabase
      .from("saved_searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id);

    if (countError) {
      logError({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(countError.message),
      });
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    if (isLimitReached(searchCount ?? 0, tenantPlan)) {
      logLimitHit({
        request,
        route: routeLabel,
        actorId: auth.user.id,
        planTier: tenantPlan.tier,
        maxSavedSearches: tenantPlan.maxSavedSearches,
        searchCount: searchCount ?? 0,
      });
      return NextResponse.json(
        {
          error: "Saved search limit reached",
          code: "limit_reached",
          maxSavedSearches: tenantPlan.maxSavedSearches,
          searchCount: searchCount ?? 0,
          planTier: tenantPlan.tier,
        },
        { status: 409 }
      );
    }

    const body = await request.json();
    const payload = createSchema.parse(body);
    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: auth.user.id,
        name: payload.name,
        query_params: payload.query_params,
      })
      .select()
      .single();

    if (error) {
      logError({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ search: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to save search";
    logError({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return postSavedSearchResponse(request);
}
