import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { getTenantPushDiagnosticsResponse } from "../../app/api/tenant/push/diagnostics/route";

void test("tenant diagnostics rejects unauthenticated requests", async () => {
  const response = await getTenantPushDiagnosticsResponse(
    new Request("http://localhost/api/tenant/push/diagnostics"),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 401);
});

void test("tenant diagnostics returns payload for tenant role", async () => {
  let receivedUserId: string | null = null;
  let receivedAdminDb: unknown = null;

  const response = await getTenantPushDiagnosticsResponse(
    new Request("http://localhost/api/tenant/push/diagnostics"),
    {
      hasServerSupabaseEnv: () => true,
      hasServiceRoleEnv: () => false,
      requireRole: async () => ({
        ok: true,
        user: { id: "user-123" },
        role: "tenant",
        supabase: {},
      }),
      fetchTenantPushDiagnostics: async ({ userId, adminDb }) => {
        receivedUserId = userId;
        receivedAdminDb = adminDb;
        return {
          subscriptions: {
            available: true,
            error: null,
            total: 1,
            active: 1,
            last24h: 1,
            last7d: 1,
          },
          attempts: {
            available: false,
            error: "tenant attribution not recorded",
            lastAttemptAt: null,
            lastDeliveredAt: null,
            last24h: null,
            last7d: null,
            recent: [],
          },
          dedupe: {
            available: false,
            error: "service role unavailable",
            last24h: null,
            last7d: null,
            topReasons: [],
          },
        };
      },
      logFailure: () => undefined,
    }
  );

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(receivedUserId, "user-123");
  assert.equal(receivedAdminDb, null);
});

void test("tenant diagnostics rejects non-tenant roles", async () => {
  const response = await getTenantPushDiagnosticsResponse(
    new Request("http://localhost/api/tenant/push/diagnostics"),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 403);
});
