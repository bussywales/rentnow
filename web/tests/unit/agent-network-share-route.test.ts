import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { postExternalListingResponse } from "@/app/api/agent/client-pages/[id]/external-listings/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/agent/client-pages/page1/external-listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

void test("external listing insert writes curated and share rows", async () => {
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const supabaseStub = {
    from: (table: string) => {
      if (table === "agent_client_pages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "page1", agent_user_id: "agent-1" },
              }),
            }),
          }),
        };
      }
      if (table === "agent_client_page_listings") {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            insertCalls.push({ table, payload });
            return { error: null };
          },
        };
      }
      if (table === "agent_listing_shares") {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            insertCalls.push({ table, payload });
            return { error: null };
          },
        };
      }
      return {};
    },
  };

  const adminStub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "listing-1", owner_id: "owner-1", status: "live" },
          }),
        }),
      }),
    }),
  };

  const response = await postExternalListingResponse(
    makeRequest({ listingId: "listing-1" }),
    { params: Promise.resolve({ id: "page1" }) },
    {
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "agent-1" },
          supabase: supabaseStub,
        }) as any,
      hasServiceRoleEnv: () => true,
      getAppSettingBool: async () => true,
      createServiceRoleClient: () => adminStub as any,
      logPropertyEvent: async () => ({ ok: true }),
      resolveEventSessionKey: () => null,
    }
  );

  assert.equal(response.status, 200);
  const tables = insertCalls.map((call) => call.table).sort();
  assert.deepEqual(tables, ["agent_client_page_listings", "agent_listing_shares"]);
});
