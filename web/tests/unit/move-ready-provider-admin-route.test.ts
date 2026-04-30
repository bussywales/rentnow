import test from "node:test";
import assert from "node:assert/strict";
import { patchAdminMoveReadyProviderResponse } from "@/app/api/admin/services/providers/[id]/route";

void test("admin provider patch maps approved status into approved active provider state", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table !== "move_ready_service_providers") throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  };

  const response = await patchAdminMoveReadyProviderResponse(
    new Request("http://localhost/api/admin/services/providers/provider-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    }) as never,
    "provider-1",
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-04-30T12:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(updates[0]?.verification_state, "approved");
  assert.equal(updates[0]?.provider_status, "active");
  assert.equal(updates[0]?.approved_by, "admin-1");
  assert.deepEqual(analyticsEvents, ["property_prep_supplier_approved"]);
});

void test("admin provider patch maps suspended status into paused but approved supplier state", async () => {
  const updates: Array<Record<string, unknown>> = [];

  const client = {
    from: (table: string) => {
      if (table !== "move_ready_service_providers") throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  };

  const response = await patchAdminMoveReadyProviderResponse(
    new Request("http://localhost/api/admin/services/providers/provider-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    }) as never,
    "provider-1",
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      logProductAnalyticsEvent: async () => ({ ok: true }),
      now: () => new Date("2026-04-30T12:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(updates[0]?.verification_state, "approved");
  assert.equal(updates[0]?.provider_status, "paused");
  assert.equal(updates[0]?.suspended_by, "admin-1");
});
