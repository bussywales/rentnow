import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/me/seen";

export type PresenceDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  logFailure: typeof logFailure;
  now?: () => string;
};

const defaultDeps: PresenceDeps = {
  hasServerSupabaseEnv,
  requireUser,
  logFailure,
  now: () => new Date().toISOString(),
};

export async function postSeenResponse(
  request: Request,
  deps: PresenceDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const now = deps.now?.() ?? new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ last_seen_at: now })
    .eq("id", auth.user.id)
    .select("last_seen_at")
    .maybeSingle();

  if (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error.message,
    });
    return NextResponse.json({ error: "Unable to update last seen" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, last_seen_at: data?.last_seen_at ?? now });
}

export async function POST(request: NextRequest) {
  return postSeenResponse(request);
}
