import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  postInternalSupportAutocloseResponse,
  type SupportAutoCloseDeps,
} from "@/app/api/internal/support/autoclose/route";

function makeRequest(input: { secret?: string; query?: string } = {}) {
  return new NextRequest(
    `http://localhost/api/internal/support/autoclose${input.query ? `?${input.query}` : ""}`,
    {
      method: "POST",
      headers: input.secret ? { "x-cron-secret": input.secret } : undefined,
    }
  );
}

void test("support autoclose rejects invalid cron secret", async () => {
  const deps: SupportAutoCloseDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T03:00:00.000Z"),
    getResolvedDays: () => 7,
    getNewDays: () => 30,
    closeResolved: async () => 0,
    closeNew: async () => 0,
  };

  const response = await postInternalSupportAutocloseResponse(
    makeRequest({ secret: "wrong-secret" }),
    deps
  );
  assert.equal(response.status, 403);
});

void test("support autoclose closes stale resolved and new tickets", async () => {
  const calls: Array<{ kind: "resolved" | "new"; beforeIso: string }> = [];
  const deps: SupportAutoCloseDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T03:00:00.000Z"),
    getResolvedDays: () => 7,
    getNewDays: () => 30,
    closeResolved: async ({ beforeIso }) => {
      calls.push({ kind: "resolved", beforeIso });
      return 3;
    },
    closeNew: async ({ beforeIso }) => {
      calls.push({ kind: "new", beforeIso });
      return 2;
    },
  };

  const response = await postInternalSupportAutocloseResponse(
    makeRequest({ secret: "cron-secret" }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.resolvedDays, 7);
  assert.equal(body.newDays, 30);
  assert.equal(body.closedResolved, 3);
  assert.equal(body.closedNew, 2);
  assert.equal(body.totalClosed, 5);
  assert.equal(calls.length, 2);
});

void test("support autoclose allows disabling new-ticket closure with new_days=0", async () => {
  let closeNewCalls = 0;
  const deps: SupportAutoCloseDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T03:00:00.000Z"),
    getResolvedDays: () => 7,
    getNewDays: () => 30,
    closeResolved: async () => 1,
    closeNew: async () => {
      closeNewCalls += 1;
      return 99;
    },
  };

  const response = await postInternalSupportAutocloseResponse(
    makeRequest({ secret: "cron-secret", query: "new_days=0" }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.newDays, 0);
  assert.equal(body.closedResolved, 1);
  assert.equal(body.closedNew, 0);
  assert.equal(closeNewCalls, 0);
});
