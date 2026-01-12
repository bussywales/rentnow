import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import {
  getPushConfig,
  sendPushNotification,
  type PushSubscriptionRow,
} from "@/lib/push/server";
import {
  insertPushDeliveryAttempt,
  type PushDeliveryInsert,
} from "@/lib/admin/push-delivery-telemetry";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/push/test";

type PushTestDeps = {
  requireRole?: typeof requireRole;
  getPushConfig?: typeof getPushConfig;
  sendPushNotification?: typeof sendPushNotification;
  logEvent?: (payload: Record<string, unknown>) => void;
  recordTelemetry?: (input: PushDeliveryInsert) => Promise<void>;
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
};

const defaultLogEvent = (payload: Record<string, unknown>) => {
  console.info(JSON.stringify(payload));
};

const defaultDeps: PushTestDeps = {
  requireRole,
  getPushConfig,
  sendPushNotification,
  logEvent: defaultLogEvent,
  hasServiceRoleEnv,
  createServiceRoleClient,
};

export async function postAdminPushTestResponse(
  request: Request,
  deps: PushTestDeps = defaultDeps
) {
  const startTime = Date.now();
  const requireRoleFn = deps.requireRole ?? requireRole;
  const getConfig = deps.getPushConfig ?? getPushConfig;
  const sendPush = deps.sendPushNotification ?? sendPushNotification;
  const logEvent = deps.logEvent ?? defaultLogEvent;
  const hasServiceRole = (deps.hasServiceRoleEnv ?? hasServiceRoleEnv)();

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  let adminDb: ReturnType<typeof createServiceRoleClient> | null = null;
  if (hasServiceRole) {
    try {
      const createAdminDb = deps.createServiceRoleClient ?? createServiceRoleClient;
      adminDb = createAdminDb();
    } catch {
      adminDb = null;
    }
  }

  const recordTelemetry =
    deps.recordTelemetry ??
    (async (input: PushDeliveryInsert) => {
      if (!adminDb) return;
      try {
        await insertPushDeliveryAttempt(adminDb, input);
      } catch {
        // Telemetry failure should never block the request.
      }
    });

  const config = getConfig();
  if (!config.configured) {
    await recordTelemetry({
      actorUserId: auth.user.id,
      kind: "admin_test",
      status: "blocked",
      reasonCode: "push_not_configured",
      blockedCount: 1,
      meta: { subscriptionCount: 0 },
    });
    logEvent({
      event: "admin_push_test",
      admin_id: auth.user.id,
      outcome: "push_not_configured",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "push_not_configured",
        message: "Push notifications are not configured.",
      },
      { status: 503 }
    );
  }

  const { data, error } = await auth.supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true);

  if (error) {
    await recordTelemetry({
      actorUserId: auth.user.id,
      kind: "admin_test",
      status: "failed",
      reasonCode: "unknown",
      failedCount: 1,
      meta: { stage: "subscription_lookup" },
    });
    logEvent({
      event: "admin_push_test",
      admin_id: auth.user.id,
      outcome: "subscription_lookup_failed",
    });
    return NextResponse.json(
      { ok: false, code: "unexpected_error" },
      { status: 500 }
    );
  }

  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) {
    await recordTelemetry({
      actorUserId: auth.user.id,
      kind: "admin_test",
      status: "skipped",
      reasonCode: "no_subscriptions",
      skippedCount: 1,
      meta: { subscriptionCount: 0 },
    });
    logEvent({
      event: "admin_push_test",
      admin_id: auth.user.id,
      outcome: "no_subscriptions",
    });
    return NextResponse.json({
      ok: false,
      code: "no_subscriptions",
    });
  }

  await recordTelemetry({
    actorUserId: auth.user.id,
    kind: "admin_test",
    status: "attempted",
    meta: { subscriptionCount: subscriptions.length },
  });

  let failures = 0;
  let goneCount = 0;
  let timeoutCount = 0;
  const staleEndpoints: string[] = [];
  for (const subscription of subscriptions) {
    const result = await sendPush({
      subscription,
      payload: {
        title: "RentNow Test Notification",
        body: "Push notifications are configured correctly on this device.",
      },
    });
    if (!result.ok) {
      failures += 1;
      if (result.statusCode === 404 || result.statusCode === 410) {
        goneCount += 1;
        staleEndpoints.push(subscription.endpoint);
      }
      if (result.statusCode === 408 || result.statusCode === 504) {
        timeoutCount += 1;
      }
    }
  }

  const attempted = subscriptions.length;
  const sent = attempted - failures;
  const outcome = failures === 0 ? "sent" : "send_failed";
  const reasonCode =
    failures === 0
      ? null
      : goneCount > 0
        ? "410_gone"
        : timeoutCount > 0
          ? "timeout"
          : "unknown";

  await recordTelemetry({
    actorUserId: auth.user.id,
    kind: "admin_test",
    status: failures === 0 ? "delivered" : "failed",
    reasonCode,
    deliveredCount: sent,
    failedCount: failures,
    meta: {
      subscriptionCount: attempted,
      goneCount,
      timeoutCount,
    },
  });

  logEvent({
    event: "admin_push_test",
    admin_id: auth.user.id,
    attempted,
    sent,
    outcome,
  });

  if (staleEndpoints.length) {
    await auth.supabase
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", auth.user.id)
      .in("endpoint", staleEndpoints);
  }

  if (failures > 0) {
    return NextResponse.json(
      {
        ok: false,
        code: reasonCode ?? "send_failed",
        attempted,
        sent,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    attempted,
    sent,
  });
}

export async function POST(request: Request) {
  return postAdminPushTestResponse(request);
}
