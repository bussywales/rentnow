import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { validateRequestNote } from "@/lib/admin/admin-review-actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const body = await req.json().catch(() => ({}));
  const validation = validateRequestNote(body?.note);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message || "Invalid note", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const { data: property } = await supabase.from("properties").select("id,status").eq("id", id).maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("properties")
    .update({
      status: "changes_requested",
      is_approved: false,
      is_active: false,
      rejected_at: now,
      rejection_reason: body.note,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to update", code: "SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status: "changes_requested" });
}
