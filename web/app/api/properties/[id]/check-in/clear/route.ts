import { NextResponse } from "next/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv() || !hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Service role env vars missing", code: "not_configured" },
      { status: 503 }
    );
  }
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleClient() as unknown as UntypedAdminClient;
  const auth = await requireUser({
    request,
    route: "/api/properties/[id]/check-in/clear",
    supabase,
    startTime,
  });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(supabase, auth.user.id);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: property, error: propError } = await service
    .from("properties")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (propError) return NextResponse.json({ error: propError.message }, { status: 400 });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { error: insertError } = await service.from("property_checkins").insert([
    {
      property_id: id,
      distance_bucket: null,
      method: "cleared",
      accuracy_m: null,
      verified_by: auth.user.id,
      role,
    },
  ]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
