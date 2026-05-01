import test from "node:test";
import assert from "node:assert/strict";
import { patchAdminMoveReadyRequestStatusResponse } from "@/app/api/admin/services/requests/[id]/status/route";

void test("admin request status route awards a positively responded provider", async () => {
  const requestUpdates: Array<Record<string, unknown>> = [];
  const leadUpdates: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "move_ready_requests") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "request-1",
                  requester_user_id: "owner-1",
                  requester_role: "landlord",
                  property_id: "11111111-1111-1111-1111-111111111111",
                  market_code: "NG",
                  area: "Lekki",
                  category: "minor_repairs_handyman",
                  matched_provider_count: 2,
                  status: "matched",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            requestUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "move_ready_request_leads") {
        return {
          select: () => ({
            eq: (_key: string, _requestId: string) => ({
              eq: (_providerKey: string, _providerId: string) => ({
                maybeSingle: async () => ({
                  data: {
                    id: "lead-1",
                    provider_id: "22222222-2222-4222-8222-222222222222",
                    routing_status: "accepted",
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            leadUpdates.push(payload);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await patchAdminMoveReadyRequestStatusResponse(
    new Request("http://localhost/api/admin/services/requests/request-1/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "award",
        providerId: "22222222-2222-4222-8222-222222222222",
      }),
    }) as never,
    "request-1",
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
      now: () => new Date("2026-05-01T18:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "awarded");
  assert.equal(requestUpdates[0]?.status, "awarded");
  assert.equal(requestUpdates[0]?.awarded_provider_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(leadUpdates[0]?.routing_status, "awarded");
  assert.deepEqual(analyticsEvents, ["property_prep_request_awarded"]);
});

void test("admin request status route closes no-match requests", async () => {
  const requestUpdates: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "move_ready_requests") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "request-2",
                  requester_user_id: "owner-2",
                  requester_role: "agent",
                  property_id: null,
                  market_code: "NG",
                  area: "Yaba",
                  category: "end_of_tenancy_cleaning",
                  matched_provider_count: 0,
                  status: "unmatched",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            requestUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "move_ready_request_leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await patchAdminMoveReadyRequestStatusResponse(
    new Request("http://localhost/api/admin/services/requests/request-2/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_no_match" }),
    }) as never,
    "request-2",
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
      now: () => new Date("2026-05-01T18:30:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "closed_no_match");
  assert.equal(requestUpdates[0]?.status, "closed_no_match");
  assert.deepEqual(analyticsEvents, ["property_prep_request_closed_no_match"]);
});
