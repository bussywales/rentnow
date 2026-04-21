import test from "node:test";
import assert from "node:assert/strict";

import { getConfigStatusResponse } from "@/app/api/admin/config-status/route";

test("config status rejects when supabase env missing", async () => {
  const response = await getConfigStatusResponse({
    hasServerSupabaseEnv: () => false,
    createServerSupabaseClient: async () => {
      throw new Error("should not create client");
    },
    getUserRole: async () => "admin",
    getCriticalSchemaReadiness: async () => ({
      ready: true,
      checkedAt: "2026-04-21T10:00:00.000Z",
      checkedCount: 8,
      missing: [],
      queryError: null,
    }),
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
    getCriticalSchemaReadiness: async () => ({
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
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.flags.enable_location_picker, true);
  assert.equal(body.schema.ready, false);
  assert.deepEqual(body.schema.missingColumns, ["properties.commercial_layout_type"]);
  assert.equal(typeof body.env.sentryServerConfigured, "boolean");
  assert.equal(typeof body.env.sentryClientConfigured, "boolean");
  assert.equal(typeof body.env.sentryReleaseConfigured, "boolean");
  assert.equal(typeof body.env.commitSha === "string" || body.env.commitSha === null, true);
});
