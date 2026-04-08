import test from "node:test";
import assert from "node:assert/strict";
import { postMoveReadyProviderLeadResponse } from "@/app/api/services/provider/respond/route";

void test("provider response route records accepted lead and response note", async () => {
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
  assert.deepEqual(analyticsEvents, ["provider_lead_accepted", "provider_response_submitted"]);
});
