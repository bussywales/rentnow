import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getPushConfig } from "@/lib/push/server";

const routeLabel = "/api/push/subscribe";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

type SubscribeDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireUser?: typeof requireUser;
  getPushConfig?: typeof getPushConfig;
  logFailure?: typeof logFailure;
};

export async function postPushSubscribeResponse(request: Request, deps: SubscribeDeps = {}) {
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

  const config = getConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        ok: false,
        code: "push_not_configured",
        message: "Push notifications are not configured.",
      },
      { status: 503 }
    );
  }

  const auth = await requireUserFn({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid subscription payload." },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent");
  const payload: Record<string, unknown> = {
    profile_id: auth.user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  if (userAgent) {
    payload.user_agent = userAgent;
  }

  const { error } = await auth.supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "profile_id,endpoint" });

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

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return postPushSubscribeResponse(request);
}
