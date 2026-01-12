import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { postAdminPushTestResponse } from "../../app/api/admin/push/test/route";

type QueryResult = { data?: unknown[] | null; error?: { message: string } | null };

void test("admin push test denies non-admin access", async () => {
  const response = await postAdminPushTestResponse(
    new Request("http://localhost/api/admin/push/test", { method: "POST" }),
    {
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }),
      getPushConfig: () => ({ configured: true }),
      sendPushNotification: async () => ({ ok: true }),
      logEvent: () => undefined,
    }
  );

  assert.equal(response.status, 403);
});

void test("admin push test returns no_subscriptions when none exist", async () => {
  const telemetry: Array<{ status: string; reasonCode?: string | null }> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      const query = {
        select: () => query,
        eq: () => query,
        then: (resolve: (value: QueryResult) => void) =>
          resolve({ data: [], error: null }),
      };
      return query;
    },
  };

  const response = await postAdminPushTestResponse(
    new Request("http://localhost/api/admin/push/test", { method: "POST" }),
    {
      requireRole: async () => ({
        ok: true,
        supabase,
        user: { id: "admin-1" },
        role: "admin",
      }),
      getPushConfig: () => ({ configured: true }),
      sendPushNotification: async () => ({ ok: true }),
      logEvent: () => undefined,
      recordTelemetry: async (input: { status: string; reasonCode?: string | null }) => {
        telemetry.push({ status: input.status, reasonCode: input.reasonCode });
      },
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.code, "no_subscriptions");
  assert.equal(telemetry.at(-1)?.status, "skipped");
  assert.equal(telemetry.at(-1)?.reasonCode, "no_subscriptions");
});

void test("admin push test blocks when push is not configured", async () => {
  const telemetry: Array<{ status: string; reasonCode?: string | null }> = [];
  const response = await postAdminPushTestResponse(
    new Request("http://localhost/api/admin/push/test", { method: "POST" }),
    {
      requireRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-2" },
        role: "admin",
      }),
      getPushConfig: () => ({ configured: false }),
      sendPushNotification: async () => ({ ok: true }),
      logEvent: () => undefined,
      recordTelemetry: async (input: { status: string; reasonCode?: string | null }) => {
        telemetry.push({ status: input.status, reasonCode: input.reasonCode });
      },
    }
  );

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "push_not_configured");
  assert.equal(telemetry.at(-1)?.status, "blocked");
  assert.equal(telemetry.at(-1)?.reasonCode, "push_not_configured");
});

void test("admin push test sends to current admin subscriptions", async () => {
  let sendCalls = 0;
  const telemetry: Array<{ status: string; reasonCode?: string | null }> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      const query = {
        select: () => query,
        eq: () => query,
        then: (resolve: (value: QueryResult) => void) =>
          resolve({
            data: [
              { endpoint: "https://example.test/1", p256dh: "key1", auth: "auth1" },
              { endpoint: "https://example.test/2", p256dh: "key2", auth: "auth2" },
            ],
            error: null,
          }),
      };
      return query;
    },
  };

  const response = await postAdminPushTestResponse(
    new Request("http://localhost/api/admin/push/test", { method: "POST" }),
    {
      requireRole: async () => ({
        ok: true,
        supabase,
        user: { id: "admin-3" },
        role: "admin",
      }),
      getPushConfig: () => ({ configured: true }),
      sendPushNotification: async () => {
        sendCalls += 1;
        return { ok: true };
      },
      logEvent: () => undefined,
      recordTelemetry: async (input: { status: string; reasonCode?: string | null }) => {
        telemetry.push({ status: input.status, reasonCode: input.reasonCode });
      },
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(sendCalls, 2);
  assert.equal(telemetry[0]?.status, "attempted");
  assert.equal(telemetry.at(-1)?.status, "delivered");
});
