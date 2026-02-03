import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/product-updates/[id]/publish";

export async function POST(
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

  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("product_updates")
    .update({ published_at: nowIso })
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
