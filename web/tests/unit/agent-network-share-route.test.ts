import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { postExternalListingResponse } from "@/app/api/agent/client-pages/[id]/external-listings/route";

const TEST_LISTING_ID = "11111111-1111-4111-8111-111111111111";

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
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: TEST_LISTING_ID, owner_id: "owner-1", status: "live" },
              }),
            }),
          }),
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

  const response = await postExternalListingResponse(
    makeRequest({ listingId: TEST_LISTING_ID }),
    { params: Promise.resolve({ id: "page1" }) },
    {
      requireRole: (async () => ({
        ok: true,
        user: { id: "agent-1" } as User,
        supabase: supabaseStub as unknown as SupabaseClient,
        role: "agent",
      })) as typeof requireRole,
      hasServiceRoleEnv: () => true,
      getAppSettingBool: async () => true,
      createServiceRoleClient: () =>
        adminStub as unknown as ReturnType<typeof createServiceRoleClient>,
      logPropertyEvent: async () => ({ ok: true }),
      resolveEventSessionKey: () => null,
    }
  );

  assert.equal(response.status, 200);
  const tables = insertCalls.map((call) => call.table).sort();
  assert.deepEqual(tables, ["agent_client_page_listings", "agent_listing_shares"]);
});
