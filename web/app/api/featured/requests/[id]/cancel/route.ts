import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/featured/requests/[id]/cancel";

type RequestRow = {
  id: string;
  requester_user_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;

  const { data, error } = await client
    .from("featured_requests")
    .select("id,requester_user_id,status")
    .eq("id", id)
    .maybeSingle();

  const row = (data as RequestRow | null) ?? null;
  if (error || !row) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (row.requester_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be cancelled." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await client
    .from("featured_requests")
    .update({
      status: "cancelled",
      decided_by: auth.user.id,
      decided_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id,property_id,requester_user_id,status,decided_at,updated_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || "Unable to cancel request." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, request: updated });
}
