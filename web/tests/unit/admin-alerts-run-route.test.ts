import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postAdminAlertsRunResponse,
  type AdminAlertsRunDeps,
} from "@/app/api/admin/alerts/run/route";

const makeRequest = (secret?: string) =>
  new NextRequest("http://localhost/api/admin/alerts/run", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });

void test("admin alerts run route rejects requests without cron secret or admin auth", async () => {
  const deps: AdminAlertsRunDeps = {
    hasServerSupabaseEnv: () => true,
    getCronSecret: () => "cron-secret",
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    }),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminAlertsRunDeps["requireRole"]>>,
  };

  const response = await postAdminAlertsRunResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("admin alerts run route works with valid cron secret", async () => {
  let roleChecks = 0;
  const deps: AdminAlertsRunDeps = {
    hasServerSupabaseEnv: () => true,
    getCronSecret: () => "cron-secret",
    requireRole: async () => {
      roleChecks += 1;
      return {
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1" } as never,
        role: "admin",
      } as Awaited<ReturnType<AdminAlertsRunDeps["requireRole"]>>;
    },
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 9,
      processedUsers: 4,
      sent: 5,
      emailsSent: 4,
      failed: 1,
      skipped: 3,
      duplicates: 2,
      noMatches: 2,
    }),
  };

  const response = await postAdminAlertsRunResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.users_processed, 4);
  assert.equal(body.emails_sent, 4);
  assert.equal(roleChecks, 0);
});
