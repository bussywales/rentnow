import test from "node:test";
import assert from "node:assert/strict";

import { getOperatorMonitoringSnapshot } from "@/lib/monitoring/operator-status";

void test("operator monitoring snapshot reports healthy runtime when database, schema, sentry, and release are ready", async () => {
  const snapshot = await getOperatorMonitoringSnapshot(
    {
      from: () => ({
        select: () => ({
          limit: async () => ({ error: null }),
        }),
      }),
      rpc: async () => ({
        data: [
          { table_name: "properties", column_name: "commercial_layout_type" },
          { table_name: "properties", column_name: "enclosed_rooms" },
          { table_name: "properties", column_name: "backup_power_type" },
          { table_name: "properties", column_name: "water_supply_type" },
          { table_name: "properties", column_name: "internet_availability" },
          { table_name: "properties", column_name: "security_type" },
          { table_name: "properties", column_name: "road_access_quality" },
          { table_name: "properties", column_name: "flood_risk_disclosure" },
        ],
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
  );

  assert.equal(snapshot.overallState, "healthy");
  assert.equal(snapshot.checks.database.state, "healthy");
  assert.equal(snapshot.checks.schema.state, "healthy");
  assert.equal(snapshot.checks.sentry.state, "healthy");
  assert.equal(snapshot.checks.release.state, "healthy");
});

void test("operator monitoring snapshot reports broken and degraded checks without hiding failures", async () => {
  const snapshot = await getOperatorMonitoringSnapshot(
    {
      from: () => ({
        select: () => ({
          limit: async () => ({
            error: { message: "relation properties missing" },
          }),
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
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
    } as NodeJS.ProcessEnv
  );

  assert.equal(snapshot.overallState, "broken");
  assert.equal(snapshot.checks.database.state, "broken");
  assert.equal(snapshot.checks.schema.state, "broken");
  assert.equal(snapshot.checks.sentry.state, "broken");
  assert.equal(snapshot.checks.release.state, "degraded");
  assert.equal(snapshot.counts.broken >= 3, true);
});
