import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { checkPushRateLimit } from "@/lib/push/rate-limit";

const routeLabel = "/api/push/unsubscribe";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

type UnsubscribeDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireUser?: typeof requireUser;
  checkPushRateLimit?: typeof checkPushRateLimit;
  logFailure?: typeof logFailure;
};

export async function postPushUnsubscribeResponse(request: Request, deps: UnsubscribeDeps = {}) {
  const startTime = Date.now();
  const requireUserFn = deps.requireUser ?? requireUser;
  const checkRateLimit = deps.checkPushRateLimit ?? checkPushRateLimit;
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
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

  const rateLimit = await checkRateLimit({
    routeKey: "unsubscribe",
    userId: auth.user.id,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "push_rate_limited",
        message: "Too many unsubscribe requests. Please try again shortly.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid unsubscribe payload." },
      { status: 400 }
    );
  }

  const { error } = await auth.supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("endpoint", parsed.data.endpoint);

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
  return postPushUnsubscribeResponse(request);
}
