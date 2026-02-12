import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { searchProperties } from "@/lib/search";
import { getTenantPlanForTier } from "@/lib/plans";
import { parseFiltersFromSavedSearch } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

const routeLabel = "/api/saved-searches/[id]";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  query_params: z.record(z.string(), z.unknown()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
  alerts_enabled: z.boolean().optional(),
  alert_frequency: z.enum(["instant", "daily", "weekly"]).optional(),
  action: z.enum(["check"]).optional(),
});

function toFilters(queryParams: Record<string, unknown>): ParsedSearchFilters {
  return parseFiltersFromSavedSearch(queryParams);
}

type SavedSearchByIdDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  searchProperties: typeof searchProperties;
  getTenantPlanForTier: typeof getTenantPlanForTier;
};

const defaultDeps: SavedSearchByIdDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  searchProperties,
  getTenantPlanForTier,
};

export async function patchSavedSearchByIdResponse(
  request: Request,
  context: { params: Promise<{ id: string }> },
  deps: SavedSearchByIdDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    logFailure({
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
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const payload = patchSchema.parse(body);
  const nextQueryParams = payload.filters ?? payload.query_params;

  const { data: existing, error: fetchError } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
  }

  if (payload.action === "check") {
    const filters = toFilters(existing.query_params || {});
    let approvedBefore: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.role === "tenant") {
      const { data: planRow } = await supabase
        .from("profile_plans")
        .select("plan_tier, valid_until")
        .eq("profile_id", auth.user.id)
        .maybeSingle();
      const validUntil = planRow?.valid_until ?? null;
      const expired =
        !!validUntil && Number.isFinite(Date.parse(validUntil)) && Date.parse(validUntil) < Date.now();
      const tenantPlan = deps.getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
      if (tenantPlan.tier !== "tenant_pro" && tenantPlan.earlyAccessMinutes > 0) {
        approvedBefore = new Date(
          Date.now() - tenantPlan.earlyAccessMinutes * 60 * 1000
        ).toISOString();
      }
    }

    const { data, error, count } = await deps.searchProperties(filters, {
      page: 1,
      pageSize: 1,
      approvedBefore,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const matchCount =
      typeof count === "number" ? count : (data?.length ?? 0);
    const checkedAt = new Date().toISOString();

    await supabase
      .from("saved_searches")
      .update({ last_checked_at: checkedAt })
      .eq("id", id)
      .eq("user_id", auth.user.id);

    return NextResponse.json({
      ok: true,
      savedSearchId: id,
      matchCount,
      checkedAt,
    });
  }

  const updates: Record<string, unknown> = {};
  if (payload.name) updates.name = payload.name;
  if (nextQueryParams) updates.query_params = nextQueryParams;
  if (typeof payload.is_active === "boolean") updates.is_active = payload.is_active;
  if (typeof payload.alerts_enabled === "boolean") updates.alerts_enabled = payload.alerts_enabled;
  if (payload.alert_frequency) updates.alert_frequency = payload.alert_frequency;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ search: existing });
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ search: data });
}

export async function deleteSavedSearchByIdResponse(
  request: Request,
  context: { params: Promise<{ id: string }> },
  deps: SavedSearchByIdDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    logFailure({
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
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return patchSavedSearchByIdResponse(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return deleteSavedSearchByIdResponse(request, context);
}
