import test from "node:test";
import assert from "node:assert/strict";
import { postAdminMoveReadyRequestDispatchResponse } from "@/app/api/admin/services/requests/[id]/dispatch/route";

void test("admin dispatch route creates a lead, updates request dispatch count, and logs dispatch analytics", async () => {
  const leadInserts: Array<Record<string, unknown>> = [];
  const leadUpdates: Array<Record<string, unknown>> = [];
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
                  id: "request-1",
                  requester_user_id: "owner-1",
                  requester_role: "landlord",
                  property_id: "11111111-1111-1111-1111-111111111111",
                  category: "minor_repairs_handyman",
                  market_code: "NG",
                  city: "Lagos",
                  area: "Lekki",
                  context_notes: "Quick repair before relist.",
                  preferred_timing_text: "This week",
                  matched_provider_count: 1,
                  status: "matched",
                  properties: { title: "Ocean View Flat" },
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

      if (table === "move_ready_service_providers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "22222222-2222-4222-8222-222222222222",
                  business_name: "Ready Repairs",
                  contact_name: "Ada",
                  email: "ada@example.com",
                  phone: null,
                  verification_state: "approved",
                  provider_status: "active",
                  move_ready_provider_categories: [{ category: "minor_repairs_handyman" }],
                  move_ready_provider_areas: [{ market_code: "NG", city: "Lagos", area: "Lekki" }],
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "move_ready_request_leads") {
        return {
          insert: (payload: Record<string, unknown>) => {
            leadInserts.push(payload);
            return Promise.resolve({ error: null });
          },
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

  const response = await postAdminMoveReadyRequestDispatchResponse(
    new Request("http://localhost/api/admin/services/requests/request-1/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "22222222-2222-4222-8222-222222222222" }),
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
      sendMoveReadyLeadEmail: async () => ({ ok: true }),
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-05-01T19:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "sent");
  assert.equal(leadInserts[0]?.routing_status, "pending_delivery");
  assert.equal(leadUpdates[0]?.routing_status, "sent");
  assert.equal(requestUpdates[0]?.matched_provider_count, 2);
  assert.deepEqual(analyticsEvents, ["provider_lead_sent", "property_prep_provider_dispatched"]);
});
