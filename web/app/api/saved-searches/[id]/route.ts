import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters } from "@/lib/types";

const routeLabel = "/api/saved-searches/[id]";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  query_params: z.record(z.any()).optional(),
  action: z.enum(["check"]).optional(),
});

function toFilters(queryParams: Record<string, unknown>): ParsedSearchFilters {
  return {
    city: typeof queryParams.city === "string" ? queryParams.city : null,
    minPrice:
      typeof queryParams.minPrice === "number"
        ? queryParams.minPrice
        : queryParams.minPrice
        ? Number(queryParams.minPrice)
        : null,
    maxPrice:
      typeof queryParams.maxPrice === "number"
        ? queryParams.maxPrice
        : queryParams.maxPrice
        ? Number(queryParams.maxPrice)
        : null,
    currency: typeof queryParams.currency === "string" ? queryParams.currency : null,
    bedrooms:
      typeof queryParams.bedrooms === "number"
        ? queryParams.bedrooms
        : queryParams.bedrooms
        ? Number(queryParams.bedrooms)
        : null,
    rentalType:
      queryParams.rentalType === "short_let" || queryParams.rentalType === "long_term"
        ? queryParams.rentalType
        : null,
    furnished:
      queryParams.furnished === true || queryParams.furnished === false
        ? queryParams.furnished
        : queryParams.furnished === "true"
        ? true
        : queryParams.furnished === "false"
        ? false
        : null,
    amenities: Array.isArray(queryParams.amenities)
      ? queryParams.amenities.filter((item): item is string => typeof item === "string")
      : typeof queryParams.amenities === "string"
      ? queryParams.amenities.split(",").map((item) => item.trim()).filter(Boolean)
      : [],
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
      { error: "Supabase is not configured; saved searches are unavailable." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json();
  const payload = patchSchema.parse(body);

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
    const { data, error, count } = await searchProperties(filters, {
      page: 1,
      pageSize: 3,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const sampleIds = (data || [])
      .map((item) => item.id)
      .filter(Boolean)
      .slice(0, 3);

    await supabase
      .from("saved_searches")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.user.id);

    return NextResponse.json({ total: count ?? sampleIds.length, sampleIds });
  }

  const updates: Record<string, unknown> = {};
  if (payload.name) updates.name = payload.name;
  if (payload.query_params) updates.query_params = payload.query_params;

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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
      { error: "Supabase is not configured; saved searches are unavailable." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
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
