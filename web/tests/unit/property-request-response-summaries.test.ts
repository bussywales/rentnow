import test from "node:test";
import assert from "node:assert/strict";

import { listPropertyRequestResponseSummaries } from "@/lib/requests/property-request-responses.server";

void test("property request response summaries aggregate counts, responders, and first/latest timestamps", async () => {
  const summaries = await listPropertyRequestResponseSummaries({
    supabase: {
      from: () => ({
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                {
                  request_id: "req-1",
                  responder_user_id: "agent-1",
                  created_at: "2026-04-20T10:00:00.000Z",
                },
                {
                  request_id: "req-1",
                  responder_user_id: "agent-1",
                  created_at: "2026-04-20T11:00:00.000Z",
                },
                {
                  request_id: "req-1",
                  responder_user_id: "landlord-1",
                  created_at: "2026-04-21T09:00:00.000Z",
                },
              ],
            }),
          }),
        }),
      }),
    } as never,
    requestIds: ["req-1", "req-2"],
  });

  assert.deepEqual(summaries.get("req-1"), {
    responseCount: 3,
    responderCount: 2,
    firstResponseAt: "2026-04-20T10:00:00.000Z",
    latestResponseAt: "2026-04-21T09:00:00.000Z",
  });
  assert.deepEqual(summaries.get("req-2"), {
    responseCount: 0,
    responderCount: 0,
    firstResponseAt: null,
    latestResponseAt: null,
  });
});
