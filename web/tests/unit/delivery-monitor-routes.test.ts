import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { postAdminDeliveryMonitorStatusResponse } from "@/app/api/admin/delivery-monitor/[itemKey]/status/route";
import { postAdminDeliveryMonitorNoteResponse } from "@/app/api/admin/delivery-monitor/[itemKey]/notes/route";
import { postAdminDeliveryMonitorTestRunResponse } from "@/app/api/admin/delivery-monitor/[itemKey]/test-runs/route";
import type { DeliveryMonitorMergedItem } from "@/lib/admin/delivery-monitor";
import { getDeliveryMonitorSeedItem } from "@/lib/admin/delivery-monitor-seed";

function createItem(key: string): DeliveryMonitorMergedItem {
  const seed = getDeliveryMonitorSeedItem(key);
  if (!seed) throw new Error(`Unknown seed ${key}`);
  return {
    ...seed,
    effectiveStatus: seed.status,
    statusOverride: null,
    latestTestRun: null,
    latestNote: null,
    testingStatus: "not_started",
    testRuns: [],
    notesLog: [],
    lastUpdatedAt: seed.repoUpdatedAt,
  };
}

void test("delivery monitor status route requires admin auth", async () => {
  const response = await postAdminDeliveryMonitorStatusResponse(
    new Request("http://localhost/api/admin/delivery-monitor/listing_publish_renew_recovery/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "green" }),
    }),
    "listing_publish_renew_recovery",
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as never,
      loadDeliveryMonitorItem: async () => null,
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    }
  );

  assert.equal(response.status, 403);
});

void test("delivery monitor status route upserts override for seeded items", async () => {
  const upserts: Array<Record<string, unknown>> = [];
  const response = await postAdminDeliveryMonitorStatusResponse(
    new Request("http://localhost/api/admin/delivery-monitor/bootcamp_launch_system/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "red" }),
    }),
    "bootcamp_launch_system",
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1", email: "ops@example.com" },
          role: "admin",
          supabase: {
            from(table: string) {
              assert.equal(table, "delivery_monitor_state_overrides");
              return {
                upsert(payload: Record<string, unknown>) {
                  upserts.push(payload);
                  return Promise.resolve({ error: null });
                },
              };
            },
          },
        }) as never,
      loadDeliveryMonitorItem: async (_supabase, key) => createItem(key),
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    }
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(upserts[0]?.item_key, "bootcamp_launch_system");
  assert.equal(upserts[0]?.status, "red");
  assert.equal(json.item.key, "bootcamp_launch_system");
});

void test("delivery monitor note route inserts operator note", async () => {
  const inserts: Array<Record<string, unknown>> = [];
  const response = await postAdminDeliveryMonitorNoteResponse(
    new Request("http://localhost/api/admin/delivery-monitor/monitoring_sentry_deep_health/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Deep health is still clean after latest release." }),
    }),
    "monitoring_sentry_deep_health",
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1", email: "ops@example.com" },
          role: "admin",
          supabase: {
            from(table: string) {
              if (table === "delivery_monitor_notes") {
                return {
                  insert(payload: Record<string, unknown>) {
                    inserts.push(payload);
                    return Promise.resolve({ error: null });
                  },
                };
              }
              if (table === "profiles") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          maybeSingle() {
                            return Promise.resolve({ data: { full_name: "Ops Lead" } });
                          },
                        };
                      },
                    };
                  },
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        }) as never,
      loadDeliveryMonitorItem: async (_supabase, key) => createItem(key),
      resolveAdminActorName: async () => "Ops Lead",
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    }
  );

  assert.equal(response.status, 201);
  assert.equal(inserts[0]?.item_key, "monitoring_sentry_deep_health");
  assert.equal(inserts[0]?.author_name, "Ops Lead");
});

void test("delivery monitor test-run route inserts latest test outcome", async () => {
  const inserts: Array<Record<string, unknown>> = [];
  const response = await postAdminDeliveryMonitorTestRunResponse(
    new Request("http://localhost/api/admin/delivery-monitor/property_request_subscriber_alerts/test-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testingStatus: "passed",
        testerName: "Marketplace QA",
        notes: "Matching and dedupe still verified.",
      }),
    }),
    "property_request_subscriber_alerts",
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1", email: "ops@example.com" },
          role: "admin",
          supabase: {
            from(table: string) {
              assert.equal(table, "delivery_monitor_test_runs");
              return {
                insert(payload: Record<string, unknown>) {
                  inserts.push(payload);
                  return Promise.resolve({ error: null });
                },
              };
            },
          },
        }) as never,
      loadDeliveryMonitorItem: async (_supabase, key) => createItem(key),
      resolveAdminActorName: async () => "Ops Lead",
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    }
  );

  assert.equal(response.status, 201);
  assert.equal(inserts[0]?.item_key, "property_request_subscriber_alerts");
  assert.equal(inserts[0]?.testing_status, "passed");
  assert.equal(inserts[0]?.tester_name, "Marketplace QA");
});
