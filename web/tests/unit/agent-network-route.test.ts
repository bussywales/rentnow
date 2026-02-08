import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { UntypedAdminClient, UntypedQuery } from "@/lib/supabase/untyped";
import { requireRole } from "@/lib/authz";
import { getAgentNetworkListingsResponse } from "@/app/api/agent/network/listings/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/agent/network/listings", { method: "GET" });

void test("agent network listings returns 403 when flag disabled", async () => {
  const requireRoleMock = (async () => ({
    ok: true,
    user: { id: "agent-1" } as User,
    supabase: {} as SupabaseClient,
    role: "agent",
  })) as typeof requireRole;

  const response = await getAgentNetworkListingsResponse(makeRequest(), {
    hasServiceRoleEnv: () => true,
    requireRole: requireRoleMock,
    getAppSettingBool: async () => false,
    createServiceRoleClient: () => ({} as UntypedAdminClient),
  });

  assert.equal(response.status, 403);
});

void test("agent network listings filters to live listings", async () => {
  const requireRoleMock = (async () => ({
    ok: true,
    user: { id: "agent-1" } as User,
    supabase: {} as SupabaseClient,
    role: "agent",
  })) as typeof requireRole;

  const listings = [
    { id: "live-1", status: "live", owner_id: "owner-1", title: "Live Home" },
    { id: "paused-1", status: "paused", owner_id: "owner-2", title: "Paused Home" },
  ];

  const query = {
    eq: () => query,
    not: () => query,
    ilike: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    range: async () => ({ data: listings, count: listings.length }),
  } satisfies UntypedQuery<Record<string, unknown>>;

  const response = await getAgentNetworkListingsResponse(makeRequest(), {
    hasServiceRoleEnv: () => true,
    requireRole: requireRoleMock,
    getAppSettingBool: async () => true,
    createServiceRoleClient: () =>
      ({
        from: () =>
          ({
            select: () => query,
          }) as UntypedQuery<Record<string, unknown>>,
      }) as UntypedAdminClient,
  });

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.listings.length, 1);
  assert.equal(json.listings[0].id, "live-1");
});
