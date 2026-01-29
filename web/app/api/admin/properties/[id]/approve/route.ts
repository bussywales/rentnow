import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing", code: "SERVER_ERROR" }, { status: 503 });
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 });
  }

  const { data: property } = await supabase.from("properties").select("id,status").eq("id", id).maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("properties")
    .update({
      status: "live",
      is_approved: true,
      is_active: true,
      approved_at: now,
      rejection_reason: null,
      rejected_at: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to approve", code: "SERVER_ERROR" }, { status: 500 });
  }

  try {
    await supabase.from("admin_actions_log").insert({
      property_id: id,
      action_type: "approve",
      actor_id: user.id,
      payload_json: { status: "live" },
    });
  } catch {
    /* ignore logging failures */
  }

  console.log("[admin-review] approve", { propertyId: id, actorId: user.id, at: now });
  return NextResponse.json({ ok: true, id, status: "live" });
}
