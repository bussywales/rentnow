import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listThreadsForUser } from "@/lib/messaging/threads";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages/threads";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ threads: [], error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  const { threads, error } = await listThreadsForUser({
    client: auth.supabase,
    userId: auth.user.id,
    role,
  });

  if (error) {
    return NextResponse.json({ threads: [], error }, { status: 500 });
  }

  return NextResponse.json({ threads });
}
