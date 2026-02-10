import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/properties/[id]/featured";

const bodySchema = z
  .object({
    is_featured: z.boolean(),
    featured_rank: z.number().int().min(0).nullable().optional(),
    featured_until: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.is_featured && value.featured_until) {
      const parsed = new Date(value.featured_until);
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["featured_until"],
          message: "Invalid featured until date",
        });
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["featured_until"],
          message: "Featured until must be in the future",
        });
      }
    }
  });

export type AdminFeaturedDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
};

const defaultDeps: AdminFeaturedDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
};

export async function getAdminFeaturedResponse(
  request: NextRequest,
  propertyId: string,
  deps: AdminFeaturedDeps = defaultDeps
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

  const adminClient = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : null;
  const client = adminClient ?? auth.supabase;

  const { data, error } = await client
    .from("properties")
    .select("id,is_featured,featured_rank,featured_until,featured_at,featured_by")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !data) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: error || "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    is_featured: data.is_featured ?? false,
    featured_rank: data.featured_rank ?? null,
    featured_until: data.featured_until ?? null,
    featured_at: data.featured_at ?? null,
    featured_by: data.featured_by ?? null,
  });
}

export async function postAdminFeaturedResponse(
  request: NextRequest,
  propertyId: string,
  deps: AdminFeaturedDeps = defaultDeps
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

  let payload: z.infer<typeof bodySchema>;
  try {
    const body = await request.json();
    payload = bodySchema.parse(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const adminClient = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : null;
  const client = adminClient ?? auth.supabase;

  const { data: property } = await client
    .from("properties")
    .select("id,is_demo")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (payload.is_featured && (property as { is_demo?: boolean | null }).is_demo) {
    return NextResponse.json({ error: "Demo listings can't be featured." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    is_featured: payload.is_featured,
    featured_rank: payload.is_featured ? payload.featured_rank ?? null : null,
    featured_until: payload.is_featured ? payload.featured_until ?? null : null,
  };

  if (payload.is_featured) {
    updates.featured_at = nowIso;
    updates.featured_by = auth.user.id;
  }

  const { data: updated, error } = await client
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .select("id,is_featured,featured_rank,featured_until")
    .maybeSingle();

  if (error || !updated) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: error || "Unable to update featured fields",
    });
    return NextResponse.json({ error: "Unable to update featured fields" }, { status: 400 });
  }

  return NextResponse.json({
    id: updated.id,
    is_featured: updated.is_featured ?? false,
    featured_rank: updated.featured_rank ?? null,
    featured_until: updated.featured_until ?? null,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return getAdminFeaturedResponse(request, id);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postAdminFeaturedResponse(request, id);
}
