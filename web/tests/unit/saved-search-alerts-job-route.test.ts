import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postSavedSearchAlertsJobResponse,
  type SavedSearchAlertsJobDeps,
} from "../../app/api/jobs/saved-search-alerts/route";

const makeRequest = (secret?: string) =>
  new NextRequest("http://localhost/api/jobs/saved-search-alerts", {
    method: "POST",
    headers: secret ? { "x-job-secret": secret } : undefined,
  });

void test("saved-search alerts job rejects requests without secret/admin access", async () => {
  const deps: SavedSearchAlertsJobDeps = {
    hasServerSupabaseEnv: () => true,
    getJobSecret: () => "job-secret",
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    }),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<SavedSearchAlertsJobDeps["requireRole"]>>,
  };

  const response = await postSavedSearchAlertsJobResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("saved-search alerts job runs with valid secret and returns send/fail counts", async () => {
  let roleChecks = 0;
  const deps: SavedSearchAlertsJobDeps = {
    hasServerSupabaseEnv: () => true,
    getJobSecret: () => "job-secret",
    requireRole: async () => {
      roleChecks += 1;
      return {
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1" } as never,
        role: "admin",
      } as Awaited<ReturnType<SavedSearchAlertsJobDeps["requireRole"]>>;
    },
    dispatchSavedSearchEmailAlerts: async () => ({
      ok: true,
      processed: 12,
      sent: 5,
      failed: 2,
      skipped: 5,
      duplicates: 1,
      noMatches: 3,
    }),
  };

  const response = await postSavedSearchAlertsJobResponse(makeRequest("job-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, 5);
  assert.equal(body.failed, 2);
  assert.equal(body.processed, 12);
  assert.equal(roleChecks, 0);
});

