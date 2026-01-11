import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getPushConfig } from "@/lib/push/server";

const routeLabel = "/api/push/status";

type StatusDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireUser?: typeof requireUser;
  getPushConfig?: typeof getPushConfig;
  logFailure?: typeof logFailure;
};

export async function getPushStatusResponse(request: Request, deps: StatusDeps = {}) {
  const startTime = Date.now();
  const requireUserFn = deps.requireUser ?? requireUser;
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const getConfig = deps.getPushConfig ?? getPushConfig;
  const logFailureFn = deps.logFailure ?? logFailure;

  if (!hasEnv()) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const auth = await requireUserFn({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const config = getConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        publicKeyPresent: !!config.publicKey,
        code: "push_not_configured",
        message: "Push notifications are not configured.",
      },
      { status: 503 }
    );
  }

  const { count, error } = await auth.supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", auth.user.id)
    .eq("is_active", true);

  if (error) {
    logFailureFn({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    publicKeyPresent: !!config.publicKey,
    vapidPublicKey: config.publicKey,
    active: (count ?? 0) > 0,
    subscriptionCount: count ?? 0,
  });
}

export async function GET(request: Request) {
  return getPushStatusResponse(request);
}
