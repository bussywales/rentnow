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
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      ({
        from: () => ({
          upsert: async () => ({ error: null }),
        }),
      }) as never,
    getCronSecret: () => "cron-secret",
    getNow: () => new Date("2026-02-12T20:00:00.000Z"),
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      failedUsers: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
      disabledReason: null,
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
  let persisted: Record<string, unknown> | null = null;
  const deps: AdminAlertsRunDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      ({
        from: () => ({
          upsert: async (payload: Record<string, unknown>) => {
            persisted = payload;
            return { error: null };
          },
        }),
      }) as never,
    getCronSecret: () => "cron-secret",
    getNow: () => new Date("2026-02-12T21:00:00.000Z"),
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
      failedUsers: 1,
      skipped: 3,
      duplicates: 2,
      noMatches: 2,
      disabledReason: null,
    }),
  };

  const response = await postAdminAlertsRunResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.users_processed, 4);
  assert.equal(body.emails_sent, 4);
  assert.equal(body.failed_users, 1);
  assert.equal(roleChecks, 0);
  assert.equal((persisted?.key as string) || "", "alerts_last_run_status_json");
  assert.equal((persisted?.value as Record<string, unknown>)?.mode, "cron");
});

void test("admin alerts run route persists disabled reason when kill switch blocks sends", async () => {
  let persisted: Record<string, unknown> | null = null;
  const deps: AdminAlertsRunDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      ({
        from: () => ({
          upsert: async (payload: Record<string, unknown>) => {
            persisted = payload;
            return { error: null };
          },
        }),
      }) as never,
    getCronSecret: () => "",
    getNow: () => new Date("2026-02-12T22:00:00.000Z"),
    requireRole: async () =>
      ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1" } as never,
        role: "admin",
      }) as Awaited<ReturnType<AdminAlertsRunDeps["requireRole"]>>,
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      failedUsers: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
      disabledReason: "kill_switch",
    }),
  };

  const response = await postAdminAlertsRunResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.disabled_reason, "kill_switch");
  assert.equal((persisted?.value as Record<string, unknown>)?.disabled_reason, "kill_switch");
});
