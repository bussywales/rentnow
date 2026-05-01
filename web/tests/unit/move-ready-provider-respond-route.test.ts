import test from "node:test";
import assert from "node:assert/strict";
import { postMoveReadyProviderLeadResponse } from "@/app/api/services/provider/respond/route";

void test("provider response route records interested lead, quote summary, and operator-action analytics", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "move_ready_request_leads") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "lead-1",
                  request_id: "request-1",
                  provider_id: "33333333-3333-3333-3333-333333333333",
                  routing_status: "sent",
                  response_note: null,
                  quote_summary: null,
                  move_ready_requests: {
                    requester_role: "landlord",
                    market_code: "NG",
                    area: "Lekki",
                    property_id: "44444444-4444-4444-4444-444444444444",
                    category: "minor_repairs_handyman",
                    matched_provider_count: 1,
                  },
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await postMoveReadyProviderLeadResponse(
    new Request("http://localhost/api/services/provider/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "secure-provider-token-123456789",
        action: "accept",
        quoteSummary: "NGN 120,000 to 150,000",
        responseNote: "Available tomorrow afternoon.",
      }),
    }) as never,
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "accepted");
  assert.equal(updates[0]?.routing_status, "accepted");
  assert.equal(updates[0]?.quote_summary, "NGN 120,000 to 150,000");
  assert.deepEqual(analyticsEvents, [
    "provider_lead_accepted",
    "provider_response_submitted",
    "property_prep_provider_response_received",
    "property_prep_request_awaiting_operator_action",
  ]);
});

void test("provider response route records need-more-information without leaking into accept/decline analytics", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "move_ready_request_leads") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "lead-2",
                  request_id: "request-2",
                  provider_id: "55555555-5555-5555-5555-555555555555",
                  routing_status: "sent",
                  response_note: null,
                  quote_summary: null,
                  move_ready_requests: {
                    requester_role: "agent",
                    market_code: "NG",
                    area: "Yaba",
                    property_id: null,
                    category: "end_of_tenancy_cleaning",
                    matched_provider_count: 1,
                  },
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await postMoveReadyProviderLeadResponse(
    new Request("http://localhost/api/services/provider/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "secure-provider-token-223456789",
        action: "need_more_information",
        responseNote: "Need room count and access window.",
      }),
    }) as never,
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-04-08T12:30:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "needs_more_information");
  assert.equal(updates[0]?.routing_status, "needs_more_information");
  assert.deepEqual(analyticsEvents, [
    "provider_response_submitted",
    "property_prep_provider_response_received",
    "property_prep_request_awaiting_operator_action",
  ]);
});
