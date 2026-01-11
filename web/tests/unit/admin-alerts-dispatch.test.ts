import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { postAdminAlertsDispatchResponse } from "../../app/api/admin/alerts/dispatch/route";

void test("dispatch denies non-admin access", async () => {
  const response = await postAdminAlertsDispatchResponse(
    new Request("http://localhost/api/admin/alerts/dispatch", { method: "POST" }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }),
      createServiceRoleClient: () => ({} as never),
      getPushConfig: () => ({ configured: false }),
      buildAdminAlerts: async () => ({ alerts: [], error: null }),
      fetchImpl: async () => new Response(null, { status: 200 }),
    }
  );

  assert.equal(response.status, 403);
});

void test("dispatch returns disabled when webhook env missing", async () => {
  const original = process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_WEBHOOK_URL;

  const response = await postAdminAlertsDispatchResponse(
    new Request("http://localhost/api/admin/alerts/dispatch", { method: "POST" }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1" } as never,
        role: "admin" as never,
      }),
      createServiceRoleClient: () => ({} as never),
      getPushConfig: () => ({ configured: false }),
      buildAdminAlerts: async () => ({
        alerts: [
          {
            key: "push-failure-spike",
            severity: "critical",
            title: "Push failures",
            summary: "Push failures spiking",
            signal: "failures=10",
            window: "last 1h",
            recommended_action: "Check push",
            runbook_link: "/admin/alerts#runbook",
            admin_path: "/admin/alerts",
            last_updated_at: "2026-01-10T10:00:00.000Z",
          },
        ],
        error: null,
      }),
      fetchImpl: async () => new Response(null, { status: 200 }),
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reason, "disabled");
  assert.equal(body.dispatched, 0);

  process.env.ALERT_WEBHOOK_URL = original;
});

void test("dispatch sends payload when enabled", async () => {
  const original = process.env.ALERT_WEBHOOK_URL;
  process.env.ALERT_WEBHOOK_URL = "https://hooks.example.test/alerting";
  let posted = false;

  const response = await postAdminAlertsDispatchResponse(
    new Request("http://localhost/api/admin/alerts/dispatch", { method: "POST" }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-2" } as never,
        role: "admin" as never,
      }),
      createServiceRoleClient: () => ({} as never),
      getPushConfig: () => ({ configured: true }),
      buildAdminAlerts: async () => ({
        alerts: [
          {
            key: "push-failure-spike",
            severity: "critical",
            title: "Push failures",
            summary: "Push failures spiking",
            signal: "failures=10",
            window: "last 1h",
            recommended_action: "Check push",
            runbook_link: "/admin/alerts#runbook",
            admin_path: "/admin/alerts",
            last_updated_at: "2026-01-10T10:00:00.000Z",
          },
        ],
        error: null,
      }),
      fetchImpl: async () => {
        posted = true;
        return new Response(null, { status: 200 });
      },
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.dispatched, 1);
  assert.equal(posted, true);

  process.env.ALERT_WEBHOOK_URL = original;
});
