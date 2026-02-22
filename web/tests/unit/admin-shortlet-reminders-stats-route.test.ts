import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminShortletReminderStatsResponse,
  type AdminShortletReminderStatsDeps,
} from "@/app/api/admin/shortlets/reminders/stats/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/shortlets/reminders/stats", {
    method: "GET",
  });
}

void test("admin shortlet reminders stats route preserves auth failures", async () => {
  const deps: AdminShortletReminderStatsDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminShortletReminderStatsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-22T10:03:00.000Z"),
    countSentInRange: async () => 0,
  };

  const response = await getAdminShortletReminderStatsResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("admin shortlet reminders stats route returns sent and failed count readout", async () => {
  let countCalls = 0;
  let startIso = "";
  let endIso = "";

  const deps: AdminShortletReminderStatsDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminShortletReminderStatsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-22T10:03:00.000Z"),
    countSentInRange: async (input) => {
      countCalls += 1;
      startIso = input.startIso;
      endIso = input.endIso;
      return 14;
    },
  };

  const response = await getAdminShortletReminderStatsResponse(makeRequest(), deps);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sentToday, 14);
  assert.equal(body.failedToday, 0);
  assert.equal(body.route, "/api/admin/shortlets/reminders/stats");
  assert.equal(body.failureSource, "cron_logs_and_artifacts");
  assert.equal(body.asOf, "2026-02-22");
  assert.equal(typeof body.nextRunAt, "string");
  assert.equal(countCalls, 1);
  assert.equal(startIso, "2026-02-22T00:00:00.000Z");
  assert.equal(endIso, "2026-02-23T00:00:00.000Z");
});
