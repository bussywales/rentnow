import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPushConfig } from "@/lib/push/server";
import {
  buildAdminAlerts,
  buildAlertWebhookPayload,
  type AdminAlert,
} from "@/lib/admin/alerting";

const routeLabel = "/api/admin/alerts/dispatch";

type DispatchDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPushConfig: typeof getPushConfig;
  buildAdminAlerts: typeof buildAdminAlerts;
  fetchImpl: typeof fetch;
};

const defaultDeps: DispatchDeps = {
  hasServiceRoleEnv,
  requireRole,
  createServiceRoleClient,
  getPushConfig,
  buildAdminAlerts,
  fetchImpl: fetch,
};

function selectDispatchAlerts(alerts: AdminAlert[]) {
  return alerts.filter((alert) => alert.severity !== "info");
}

async function dispatchWebhook(
  url: string,
  payload: ReturnType<typeof buildAlertWebhookPayload>,
  fetchImpl: typeof fetch
) {
  const attempts = 2;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return { ok: true };
      }
      lastError = `status:${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown_error";
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  return { ok: false, error: lastError ?? "dispatch_failed" };
}

export async function postAdminAlertsDispatchResponse(
  request: Request,
  deps: DispatchDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; alert dispatch unavailable." },
      { status: 503 }
    );
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const adminClient = deps.createServiceRoleClient();
  const { alerts, error } = await deps.buildAdminAlerts(
    adminClient,
    deps.getPushConfig()
  );

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({
      ok: false,
      dispatched: 0,
      reason: "disabled",
      alert_keys: alerts.map((alert) => alert.key),
      error,
    });
  }

  const dispatchAlerts = selectDispatchAlerts(alerts);
  if (!dispatchAlerts.length) {
    return NextResponse.json({
      ok: true,
      dispatched: 0,
      reason: "no_eligible_alerts",
      alert_keys: [],
      error,
    });
  }

  const payload = buildAlertWebhookPayload(dispatchAlerts);
  const result = await dispatchWebhook(webhookUrl, payload, deps.fetchImpl);

  return NextResponse.json({
    ok: result.ok,
    dispatched: result.ok ? dispatchAlerts.length : 0,
    reason: result.ok ? null : result.error,
    alert_keys: dispatchAlerts.map((alert) => alert.key),
    error,
  });
}

export async function POST(request: Request) {
  return postAdminAlertsDispatchResponse(request);
}
