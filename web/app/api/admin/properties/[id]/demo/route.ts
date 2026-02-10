import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/properties/[id]/demo";

const bodySchema = z.object({
  is_demo: z.boolean(),
});

export type AdminDemoDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
};

const defaultDeps: AdminDemoDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
};

export async function patchAdminDemoResponse(
  request: NextRequest,
  propertyId: string,
  deps: AdminDemoDeps = defaultDeps
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

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  const { data: existing, error: existingError } = await client
    .from("properties")
    .select("id,is_demo")
    .eq("id", propertyId)
    .maybeSingle();

  if (existingError || !existing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: existingError || "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    is_demo: payload.is_demo,
  };
  if (payload.is_demo) {
    updates.is_featured = false;
    updates.featured_rank = null;
    updates.featured_until = null;
  }

  const { data: updated, error: updateError } = await client
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .select("id,is_demo")
    .maybeSingle();

  if (updateError || !updated) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: updateError || "Unable to update demo status",
    });
    return NextResponse.json({ error: "Unable to update demo status." }, { status: 400 });
  }

  return NextResponse.json({
    id: updated.id,
    is_demo: !!updated.is_demo,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminDemoResponse(request, id);
}
