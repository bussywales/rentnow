import test from "node:test";
import assert from "node:assert/strict";

import { getDeepHealthResponse } from "@/app/api/health/deep/route";

void test("deep health exposes only minimal public payload on failure", async () => {
  const response = await getDeepHealthResponse(new Request("http://localhost/api/health/deep"), {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        from: () => ({
          select: () => ({
            limit: async () => ({ error: null }),
          }),
        }),
      }) as never,
    getCriticalSchemaReadiness: async () => ({
      ready: false,
      checkedAt: "2026-04-21T10:00:00.000Z",
      checkedCount: 2,
      missing: [
        {
          table: "properties",
          column: "commercial_layout_type",
          feature: "commercial listing authoring",
        },
      ],
      queryError: null,
    }),
    logFailure: () => undefined,
    now: () => 1_000,
    resolveDiagnosticAccess: async () => ({ isAdmin: false }),
  });

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: false,
    service: "propatyhub-web",
  });
  assert.equal("schemaReady" in body, false);
  assert.equal("missingColumns" in body, false);
});

void test("deep health exposes detailed schema diagnostics for admins", async () => {
  const response = await getDeepHealthResponse(new Request("http://localhost/api/health/deep"), {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        from: () => ({
          select: () => ({
            limit: async () => ({ error: null }),
          }),
        }),
      }) as never,
    getCriticalSchemaReadiness: async () => ({
      ready: false,
      checkedAt: "2026-04-21T10:00:00.000Z",
      checkedCount: 2,
      missing: [
        {
          table: "properties",
          column: "commercial_layout_type",
          feature: "commercial listing authoring",
        },
      ],
      queryError: null,
    }),
    logFailure: () => undefined,
    now: () => 1_000,
    resolveDiagnosticAccess: async () => ({ isAdmin: true }),
  });

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.schemaReady, false);
  assert.equal(body.state, "broken");
  assert.equal(body.stateLabel, "Monitoring needs attention");
  assert.equal(body.reasonCode, "SCHEMA_COLUMNS_MISSING");
  assert.equal(body.reasonLabel, "Critical schema columns missing");
  assert.equal(body.errorReason, "Critical schema columns are missing");
  assert.deepEqual(body.missingColumns, ["properties.commercial_layout_type"]);
});

void test("deep health reports minimal public success when infra is ready", async () => {
  let queryCalled = false;
  const response = await getDeepHealthResponse(new Request("http://localhost/api/health/deep"), {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        from: () => ({
          select: () => ({
            limit: async () => {
              queryCalled = true;
              return { error: null };
            },
          }),
        }),
      }) as never,
    getCriticalSchemaReadiness: async () => ({
      ready: true,
      checkedAt: "2026-04-21T10:00:00.000Z",
      checkedCount: 8,
      missing: [],
      queryError: null,
    }),
    logFailure: () => undefined,
    now: () => 2_000,
    resolveDiagnosticAccess: async () => ({ isAdmin: false }),
  });

  assert.equal(queryCalled, true);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    service: "propatyhub-web",
  });
  assert.equal("reasonCode" in body, false);
});
