import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { PRODUCT_UPDATE_AUDIENCES } from "@/lib/product-updates/constants";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/product-updates/[id]";

const updateSchema = z
  .object({
    title: z.string().min(3).max(120).optional(),
    summary: z.string().min(10).max(240).optional(),
    audience: z.enum(PRODUCT_UPDATE_AUDIENCES).optional(),
    image_url: z.string().url().nullable().optional(),
    body: z.string().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No updates provided",
  });

type UpdatePayload = z.infer<typeof updateSchema>;

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const { id } = await context.params;
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  let payload: UpdatePayload;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  const updates: Record<string, unknown> = {};
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.summary !== undefined) updates.summary = payload.summary.trim();
  if (payload.audience !== undefined) updates.audience = payload.audience;
  if (payload.image_url !== undefined) updates.image_url = normalizeImageUrl(payload.image_url);
  if (payload.body !== undefined) updates.body = payload.body;

  const { data, error } = await client
    .from("product_updates")
    .update(updates)
    .eq("id", id)
    .select(
      "id,title,summary,body,image_url,audience,published_at,created_at,updated_at,created_by"
    )
    .maybeSingle();

  if (error || !data) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: error || "Update not found",
    });
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  return NextResponse.json({ update: data });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const { id } = await context.params;
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  const { error } = await client.from("product_updates").delete().eq("id", id);

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: error || "Delete failed",
    });
    return NextResponse.json({ error: "Unable to delete update" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
