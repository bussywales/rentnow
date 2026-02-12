import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure, logSavedSearchLimitHit } from "@/lib/observability";
import { getTenantPlanForTier, isSavedSearchLimitReached } from "@/lib/plans";
import {
  buildDefaultSavedSearchName,
  normalizeSavedSearchFilters,
  stableStringify,
} from "@/lib/saved-searches/matching";

const routeLabel = "/api/saved-searches";

const createSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    query_params: z.record(z.string(), z.unknown()).optional(),
    source: z.string().trim().max(80).optional(),
  })
  .refine((value) => !!value.filters || !!value.query_params, {
    message: "filters or query_params is required",
  });

type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  query_params: Record<string, unknown> | null;
  is_active?: boolean | null;
  alerts_enabled?: boolean | null;
  alert_frequency?: "instant" | "daily" | "weekly" | null;
  alert_last_sent_at?: string | null;
  alert_baseline_at?: string | null;
  created_at?: string | null;
  last_notified_at?: string | null;
  last_checked_at?: string | null;
};

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

const defaultDeps: SavedSearchDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  getTenantPlanForTier,
  isSavedSearchLimitReached,
  logFailure,
  logSavedSearchLimitHit,
};

function normalizeRequestFilters(payload: z.infer<typeof createSchema>) {
  const base = normalizeSavedSearchFilters(payload.filters ?? payload.query_params ?? {});
  if (payload.source && !base._source) {
    base._source = payload.source;
  }
  return base;
}

function findDuplicateByFilters(input: {
  searches: SavedSearchRow[];
  filters: Record<string, unknown>;
}) {
  const canonical = stableStringify(normalizeSavedSearchFilters(input.filters));
  return input.searches.find((search) => {
    const current = normalizeSavedSearchFilters(search.query_params || {});
    return stableStringify(current) === canonical;
  });
}

export async function getSavedSearchesResponse(
  request: Request,
  deps: SavedSearchDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
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

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("saved_searches")
    .select(
      "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message, searches: [] }, { status: 400 });
  }

  return NextResponse.json({ searches: (data as unknown as SavedSearchRow[] | null) ?? [] });
}

export async function postSavedSearchResponse(
  request: Request,
  deps: SavedSearchDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
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

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Please log in to follow searches.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const payload = createSchema.parse(body || {});
    const filters = normalizeRequestFilters(payload);
    const requestedName = payload.name?.trim() || null;

    const { data: existingRows, error: existingError } = await supabase
      .from("saved_searches")
      .select(
        "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    const existing = (existingRows as unknown as SavedSearchRow[] | null) ?? [];
    const duplicate = findDuplicateByFilters({ searches: existing, filters });
    const fallbackName = buildDefaultSavedSearchName(filters);
    const effectiveName = requestedName || duplicate?.name || fallbackName;

    if (duplicate) {
      const { data: updated, error: updateError } = await supabase
        .from("saved_searches")
        .update({
          name: effectiveName,
          query_params: filters,
          is_active: true,
          alerts_enabled: true,
          alert_frequency: "daily",
          alert_baseline_at: duplicate.alert_baseline_at ?? new Date().toISOString(),
        })
        .eq("id", duplicate.id)
        .eq("user_id", auth.user.id)
        .select(
          "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
        )
        .maybeSingle<SavedSearchRow>();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message || "Unable to update followed search." },
          { status: 400 }
        );
      }
      return NextResponse.json({ search: updated, upserted: true });
    }

    const role = await deps.getUserRole(supabase, auth.user.id);
    const enforcePlanLimit = role === "tenant";
    if (enforcePlanLimit) {
      const { data: planRow } = await supabase
        .from("profile_plans")
        .select("plan_tier, valid_until")
        .eq("profile_id", auth.user.id)
        .maybeSingle();

      const validUntil = planRow?.valid_until ?? null;
      const expired =
        !!validUntil && Number.isFinite(Date.parse(validUntil)) && Date.parse(validUntil) < Date.now();
      const tenantPlan = deps.getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
      const searchCount = existing.length;
      if (deps.isSavedSearchLimitReached(searchCount, tenantPlan)) {
        deps.logSavedSearchLimitHit({
          request,
          route: routeLabel,
          actorId: auth.user.id,
          planTier: tenantPlan.tier,
          maxSavedSearches: tenantPlan.maxSavedSearches,
          searchCount,
        });
        return NextResponse.json(
          {
            error: "Saved search limit reached",
            code: "limit_reached",
            maxSavedSearches: tenantPlan.maxSavedSearches,
            searchCount,
            planTier: tenantPlan.tier,
          },
          { status: 409 }
        );
      }
    }

    const { data: created, error: insertError } = await supabase
      .from("saved_searches")
      .insert({
        user_id: auth.user.id,
        name: effectiveName,
        query_params: filters,
        is_active: true,
        alerts_enabled: true,
        alert_frequency: "daily",
        alert_baseline_at: new Date().toISOString(),
      })
      .select(
        "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
      )
      .maybeSingle<SavedSearchRow>();

    if (insertError || !created) {
      return NextResponse.json(
        { error: insertError?.message || "Unable to create followed search." },
        { status: 400 }
      );
    }

    return NextResponse.json({ search: created, upserted: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to follow search";
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "filters or query_params is required." }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return getSavedSearchesResponse(request);
}

export async function POST(request: Request) {
  return postSavedSearchResponse(request);
}
