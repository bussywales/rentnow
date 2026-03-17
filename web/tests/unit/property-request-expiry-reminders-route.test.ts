import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { postPropertyRequestExpiryRemindersResponse } from "@/app/api/internal/requests/send-expiry-reminders/route";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/internal/requests/send-expiry-reminders", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

void test("property request reminders route rejects invalid cron secret", async () => {
  const response = await postPropertyRequestExpiryRemindersResponse(makeRequest("wrong"), {
    hasServiceRoleEnv: () => true,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
    dispatchReminders: async () => ({ ok: true, scanned: 0, due: 0, sent: 0, skipped: 0, errors: [] }),
  });

  assert.equal(response.status, 403);
});

void test("property request reminders route returns stable success payload", async () => {
  const response = await postPropertyRequestExpiryRemindersResponse(makeRequest("cron-secret"), {
    hasServiceRoleEnv: () => true,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
    dispatchReminders: async () => ({ ok: true, scanned: 4, due: 2, sent: 1, skipped: 1, errors: [] }),
  });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.route, "/api/internal/requests/send-expiry-reminders");
  assert.equal(json.scanned, 4);
  assert.equal(json.due, 2);
  assert.equal(json.sent, 1);
  assert.equal(json.skipped, 1);
  assert.equal(json.errorsCount, 0);
});

void test("property request reminders route returns 500 when dispatch fails", async () => {
  const response = await postPropertyRequestExpiryRemindersResponse(makeRequest("cron-secret"), {
    hasServiceRoleEnv: () => true,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
    dispatchReminders: async () => ({ ok: false, scanned: 0, due: 0, sent: 0, skipped: 0, errors: ["service_role_missing"] }),
  });
  const json = await response.json();

  assert.equal(response.status, 500);
  assert.equal(json.error, "service_role_missing");
});
