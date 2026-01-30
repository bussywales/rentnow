import { NextRequest, NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const startTime = Date.now();
  const routeLabel = `/api/messages/thread/${id}/read`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("message_thread_reads")
    .upsert(
      {
        thread_id: id,
        user_id: auth.user.id,
        last_read_at: now,
      },
      { onConflict: "thread_id,user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, last_read_at: now });
}
