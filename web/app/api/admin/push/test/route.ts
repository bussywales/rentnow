import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import {
  getPushConfig,
  sendPushNotification,
  type PushSubscriptionRow,
} from "@/lib/push/server";
import { recordPushDeliveryAttempt } from "@/lib/push/delivery-telemetry";

const routeLabel = "/api/admin/push/test";

type PushTestDeps = {
  requireRole?: typeof requireRole;
  getPushConfig?: typeof getPushConfig;
  sendPushNotification?: typeof sendPushNotification;
  logEvent?: (payload: Record<string, unknown>) => void;
};

const defaultLogEvent = (payload: Record<string, unknown>) => {
  console.info(JSON.stringify(payload));
};

const defaultDeps: PushTestDeps = {
  requireRole,
  getPushConfig,
  sendPushNotification,
  logEvent: defaultLogEvent,
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

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const config = getConfig();
  if (!config.configured) {
    recordPushDeliveryAttempt({
      outcome: "blocked",
      reason: "push_not_configured",
      attempted: 0,
      delivered: 0,
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
    recordPushDeliveryAttempt({
      outcome: "skipped",
      reason: "no_subscriptions",
      attempted: 0,
      delivered: 0,
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

  let failures = 0;
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
    }
  }

  const attempted = subscriptions.length;
  const sent = attempted - failures;
  const outcome = failures === 0 ? "sent" : "send_failed";

  recordPushDeliveryAttempt({
    outcome: failures === 0 ? "delivered" : "failed",
    reason: failures === 0 ? "send_succeeded" : "send_failed",
    attempted,
    delivered: sent,
  });

  logEvent({
    event: "admin_push_test",
    admin_id: auth.user.id,
    attempted,
    sent,
    outcome,
  });

  if (failures > 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "unexpected_error",
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
