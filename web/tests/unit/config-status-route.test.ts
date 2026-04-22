import test from "node:test";
import assert from "node:assert/strict";

import { getConfigStatusResponse } from "@/app/api/admin/config-status/route";
import { getOperatorMonitoringSnapshot } from "@/lib/monitoring/operator-status";

test("config status rejects when supabase env missing", async () => {
  const response = await getConfigStatusResponse({
    hasServerSupabaseEnv: () => false,
    createServerSupabaseClient: async () => {
      throw new Error("should not create client");
    },
    getUserRole: async () => "admin",
    getOperatorMonitoringSnapshot: async () => {
      throw new Error("should not build monitoring snapshot");
    },
  });

  assert.equal(response.status, 503);
});

test("config status exposes schema readiness details for admins", async () => {
  const response = await getConfigStatusResponse({
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "admin-1" } } }),
        },
        from: (table: string) => ({
          select: () => ({
            in: async () =>
              table === "app_settings"
                ? {
                    data: [
                      { key: "enable_location_picker", value: { enabled: true } },
                      { key: "require_location_pin_for_publish", value: { enabled: false } },
                      { key: "show_tenant_checkin_badge", value: { enabled: true } },
                    ],
                  }
                : { data: [] },
          }),
        }),
      }) as never,
    getUserRole: async () => "admin",
    getOperatorMonitoringSnapshot: async () =>
      ({
        ...(await getOperatorMonitoringSnapshot(
          {
            from: () => ({
              select: () => ({
                limit: async () => ({ error: null }),
              }),
            }),
            rpc: async () => ({
              data: [],
              error: null,
            }),
          } as never,
          {
            NODE_ENV: "production",
            VERCEL_ENV: "production",
            SENTRY_DSN: "https://server.example/1",
            NEXT_PUBLIC_SENTRY_DSN: "https://client.example/1",
            NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
          } as NodeJS.ProcessEnv
        )),
        schema: {
          ready: false,
          checkedAt: "2026-04-21T10:00:00.000Z",
          checkedCount: 8,
          missing: [
            {
              table: "properties",
              column: "commercial_layout_type",
              feature: "commercial listing authoring",
            },
          ],
          queryError: null,
        },
        checks: {
          database: {
            key: "database",
            state: "healthy",
            label: "Database probe healthy",
            detail: "Properties probe succeeded.",
            code: null,
          },
          schema: {
            key: "schema",
            state: "broken",
            label: "Schema mismatch detected",
            detail: "Missing 1 critical columns: properties.commercial_layout_type",
            code: "SCHEMA_COLUMNS_MISSING",
          },
          sentry: {
            key: "sentry",
            state: "healthy",
            label: "Sentry capture ready",
            detail: "Server/client DSNs and release metadata are configured.",
            code: null,
          },
          release: {
            key: "release",
            state: "healthy",
            label: "Release metadata present",
            detail: "Commit abcdef12 detected.",
            code: null,
          },
        },
        overallState: "broken",
        overallLabel: "Monitoring needs attention",
        counts: { healthy: 3, degraded: 0, broken: 1 },
      }) as never,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.flags.enable_location_picker, true);
  assert.equal(body.schema.ready, false);
  assert.deepEqual(body.schema.missingColumns, ["properties.commercial_layout_type"]);
  assert.equal(body.monitoring.overallState, "broken");
  assert.equal(body.monitoring.checks.schema.label, "Schema mismatch detected");
  assert.equal(typeof body.env.sentryServerConfigured, "boolean");
  assert.equal(typeof body.env.sentryClientConfigured, "boolean");
  assert.equal(typeof body.env.sentryReleaseConfigured, "boolean");
  assert.equal(typeof body.env.commitSha === "string" || body.env.commitSha === null, true);
  assert.equal(typeof body.env.runtimeEnvironment, "string");
});
