import test from "node:test";
import assert from "node:assert/strict";
import { postMoveReadyServiceRequestResponse } from "@/app/api/services/requests/route";

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function createInsertSelectResult<T>(result: QueryResult<T>) {
  return {
    select: () => ({
      maybeSingle: async () => result,
    }),
  };
}

void test("move ready request route marks request unmatched when no providers fit", async () => {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const insertedRequests: Array<Record<string, unknown>> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { full_name: "Host One", phone: "0800", preferred_contact: "email" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "move_ready_requests") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertedRequests.push(payload);
            return createInsertSelectResult({ data: { id: "request-1" }, error: null });
          },
          update: (payload: Record<string, unknown>) => {
            updates.push({ table, payload });
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
        };
      }

      if (table === "move_ready_service_providers") {
        return {
          select: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === "move_ready_request_leads") {
        return {
          insert: () => createInsertSelectResult({ data: { id: "lead-1" }, error: null }),
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

  const response = await postMoveReadyServiceRequestResponse(
    new Request("http://localhost/api/services/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "end_of_tenancy_cleaning",
        marketCode: "NG",
        city: "Lagos",
        area: "Lekki",
        contextNotes: "Need this flat cleaned before relist.",
        preferredTimingText: "This week",
        contactPreference: "email",
        entrypointSource: "host_overview",
      }),
    }) as never,
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "user-1", email: "host@example.com" },
          role: "landlord",
        }) as never,
      sendMoveReadyLeadEmail: async () => ({ ok: true }),
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "unmatched");
  assert.equal(insertedRequests[0]?.requester_role, "landlord");
  assert.ok(
    updates.some((entry) => entry.payload.status === "unmatched" && entry.payload.matched_provider_count === 0)
  );
  assert.deepEqual(analyticsEvents, ["service_request_submitted", "service_request_unmatched"]);
});
