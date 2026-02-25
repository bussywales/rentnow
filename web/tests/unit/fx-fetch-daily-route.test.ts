import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createFxSnapshot } from "@/lib/fx/fx";
import {
  postInternalFxFetchDailyResponse,
  type InternalFxFetchDailyDeps,
} from "@/app/api/internal/fx/fetch-daily/route";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/internal/fx/fetch-daily", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

void test("fx fetch-daily route rejects invalid cron secret", async () => {
  const deps: InternalFxFetchDailyDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({ from: () => ({}) }) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T02:15:00.000Z"),
    fetchDailyFxSnapshot: async () => {
      throw new Error("should not be called");
    },
    upsertFxSnapshot: async () => {
      throw new Error("should not be called");
    },
  };

  const response = await postInternalFxFetchDailyResponse(makeRequest("wrong-secret"), deps);
  assert.equal(response.status, 403);
});

void test("fx fetch-daily route returns summary and writes snapshot", async () => {
  let upsertCalls = 0;
  const snapshot = createFxSnapshot({
    date: "2026-02-25",
    baseCurrency: "USD",
    rates: { NGN: 1500, GBP: 0.8, CAD: 1.35 },
    source: "fixture",
    fetchedAt: "2026-02-25T02:15:00.000Z",
  });
  assert.ok(snapshot);

  const deps: InternalFxFetchDailyDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({ from: () => ({}) }) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T02:15:00.000Z"),
    fetchDailyFxSnapshot: async () => snapshot as NonNullable<typeof snapshot>,
    upsertFxSnapshot: async () => {
      upsertCalls += 1;
    },
  };

  const response = await postInternalFxFetchDailyResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.route, "/api/internal/fx/fetch-daily");
  assert.equal(body.date, "2026-02-25");
  assert.equal(body.baseCurrency, "USD");
  assert.equal(body.currenciesCount, 3);
  assert.equal(upsertCalls, 1);
});

void test("fx fetch-daily route returns 500 when provider throws", async () => {
  const deps: InternalFxFetchDailyDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({ from: () => ({}) }) as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-25T02:15:00.000Z"),
    fetchDailyFxSnapshot: async () => {
      throw new Error("provider failed");
    },
    upsertFxSnapshot: async () => {},
  };

  const response = await postInternalFxFetchDailyResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, "provider failed");
});
