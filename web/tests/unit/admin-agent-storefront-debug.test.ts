import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getAdminAgentStorefrontDebugResponse,
  type AdminAgentStorefrontDebugDeps,
} from "@/app/api/admin/debug/agent-storefront/route";

const makeRequest = (slug?: string) =>
  new NextRequest(
    `http://localhost/api/admin/debug/agent-storefront${slug ? `?slug=${slug}` : ""}`,
    { method: "GET" }
  );

void test("admin debug endpoint returns ok for storefront RPC", async () => {
  const supabase = {
    rpc: async () => ({
      data: {
        ok: true,
        reason: "OK",
        agent_user_id: "agent-1",
        slug: "agent-slug",
        global_enabled: true,
        agent_storefront_enabled: true,
        role: "agent",
      },
      error: null,
    }),
  };

  const deps: AdminAgentStorefrontDebugDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminAgentStorefrontDebugDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminAgentStorefrontDebugDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminAgentStorefrontDebugDeps["requireRole"]>>,
  };

  const res = await getAdminAgentStorefrontDebugResponse(makeRequest("agent-slug"), deps);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.reason, "OK");
  assert.equal(json.data?.slug, "agent-slug");
});

void test("admin debug endpoint rejects missing slug", async () => {
  const deps: AdminAgentStorefrontDebugDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminAgentStorefrontDebugDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminAgentStorefrontDebugDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase: {} as ReturnType<AdminAgentStorefrontDebugDeps["createServerSupabaseClient"]>,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminAgentStorefrontDebugDeps["requireRole"]>>,
  };

  const res = await getAdminAgentStorefrontDebugResponse(makeRequest(), deps);
  assert.equal(res.status, 400);
});
