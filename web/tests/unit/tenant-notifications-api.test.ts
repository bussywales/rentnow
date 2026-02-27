import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import {
  getTenantNotificationSettingsResponse,
  putTenantNotificationSettingsResponse,
} from "../../app/api/tenant/notifications/settings/route";

function createGetSupabase(input: {
  countryCode?: string | null;
  prefsRow?: Record<string, unknown> | null;
}) {
  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { country_code: input.countryCode ?? null },
              }),
            }),
          }),
        };
      }

      if (table === "tenant_notification_prefs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: input.prefsRow ?? null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  };
}

void test("tenant notification settings GET returns market-aware defaults when unset", async () => {
  const response = await getTenantNotificationSettingsResponse(
    new Request("http://localhost/api/tenant/notifications/settings"),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () => ({
        ok: true,
        user: { id: "tenant-1" } as never,
        supabase: createGetSupabase({ countryCode: "NG", prefsRow: null }) as never,
        role: "tenant",
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.settings.savedSearchPushEnabled, true);
  assert.equal(body.settings.savedSearchPushMode, "instant");
  assert.equal(body.settings.timezone, "Africa/Lagos");
});

void test("tenant notification settings PUT persists and returns normalized settings", async () => {
  let upsertPayload: Record<string, unknown> | null = null;

  const supabase = {
    from: (table: string) => {
      assert.equal(table, "tenant_notification_prefs");
      return {
        upsert: (payload: Record<string, unknown>) => {
          upsertPayload = payload;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  profile_id: "tenant-1",
                  saved_search_push_enabled: false,
                  saved_search_push_mode: "daily",
                  quiet_hours_start: "22:00",
                  quiet_hours_end: "07:00",
                  timezone: "Europe/London",
                  last_saved_search_push_at: null,
                  created_at: "2026-02-27T00:00:00.000Z",
                  updated_at: "2026-02-27T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      };
    },
  };

  const response = await putTenantNotificationSettingsResponse(
    new Request("http://localhost/api/tenant/notifications/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        savedSearchPushEnabled: false,
        savedSearchPushMode: "daily",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        timezone: "Europe/London",
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () => ({
        ok: true,
        user: { id: "tenant-1" } as never,
        supabase: supabase as never,
        role: "tenant",
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  assert.ok(upsertPayload);
  assert.equal(upsertPayload.profile_id, "tenant-1");
  assert.equal(upsertPayload.saved_search_push_mode, "daily");

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.settings.savedSearchPushEnabled, false);
  assert.equal(body.settings.savedSearchPushMode, "daily");
});

void test("tenant notification settings route enforces auth", async () => {
  const response = await getTenantNotificationSettingsResponse(
    new Request("http://localhost/api/tenant/notifications/settings"),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 401);
});
