import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getAgentNetworkListingsResponse } from "@/app/api/agent/network/listings/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/agent/network/listings", { method: "GET" });

void test("agent network listings returns 403 when flag disabled", async () => {
  const response = await getAgentNetworkListingsResponse(makeRequest(), {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "agent-1" },
        supabase: {},
      }) as any,
    getAppSettingBool: async () => false,
    createServiceRoleClient: () => ({}) as any,
  });

  assert.equal(response.status, 403);
});

void test("agent network listings filters to live listings", async () => {
  const listings = [
    { id: "live-1", status: "live", owner_id: "owner-1", title: "Live Home" },
    { id: "paused-1", status: "paused", owner_id: "owner-2", title: "Paused Home" },
  ];

  const query = {
    eq: () => query,
    neq: () => query,
    ilike: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    range: async () => ({ data: listings, count: listings.length }),
  };

  const response = await getAgentNetworkListingsResponse(makeRequest(), {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "agent-1" },
        supabase: {},
      }) as any,
    getAppSettingBool: async () => true,
    createServiceRoleClient: () =>
      ({
        from: () => ({
          select: () => query,
        }),
      }) as any,
  });

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.listings.length, 1);
  assert.equal(json.listings[0].id, "live-1");
});
