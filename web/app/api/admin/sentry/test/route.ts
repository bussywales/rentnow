import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/admin-session";
import { captureServerException } from "@/lib/monitoring/sentry";

const routeLabel = "/api/admin/sentry/test";

type AdminSentryTestDeps = {
  requireAdminRole?: typeof requireAdminRole;
  captureServerException?: typeof captureServerException;
};

const defaultDeps: AdminSentryTestDeps = {
  requireAdminRole,
  captureServerException,
};

export async function postAdminSentryTestResponse(
  request: Request,
  deps: AdminSentryTestDeps = defaultDeps
) {
  const startTime = Date.now();
  const requireAdminRoleFn = deps.requireAdminRole ?? requireAdminRole;
  const captureServerExceptionFn =
    deps.captureServerException ?? captureServerException;

  const auth = await requireAdminRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const error = new Error("Admin-triggered temporary Sentry server verification event");

  captureServerExceptionFn(error, {
    route: routeLabel,
    request,
    status: 500,
    userId: auth.user.id,
    userRole: auth.role,
    tags: {
      feature: "admin_alerts",
      sentry_test: "server_verification",
      temporary: true,
    },
    extra: {
      source: "postAdminSentryTestResponse",
      action: "send_test_sentry_server_event",
    },
    fingerprint: ["admin-alerts", "sentry-test", "server"],
  });

  return NextResponse.json({
    ok: true,
    code: "sentry_server_event_sent",
  });
}

export async function POST(request: Request) {
  return postAdminSentryTestResponse(request);
}
