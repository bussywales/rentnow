import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/leads/[id]/notes/[noteId]";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id, noteId } = await params;
  if (!id || !noteId) {
    return NextResponse.json({ error: "Missing note id." }, { status: 400 });
  }

  const { data: note } = await auth.supabase
    .from("lead_notes")
    .select("id, author_user_id, lead_id")
    .eq("id", noteId)
    .eq("lead_id", id)
    .maybeSingle();

  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  if (auth.role !== "admin" && note.author_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("lead_notes")
    .delete()
    .eq("id", noteId)
    .eq("lead_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
