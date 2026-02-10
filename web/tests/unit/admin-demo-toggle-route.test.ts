import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  patchAdminDemoResponse,
  type AdminDemoDeps,
} from "@/app/api/admin/properties/[id]/demo/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/properties/prop-1/demo", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

type PropertyRow = {
  id: string;
  is_demo?: boolean | null;
  is_featured?: boolean | null;
  featured_rank?: number | null;
  featured_until?: string | null;
};

const buildSupabaseStub = (
  row: PropertyRow,
  capture: { updatePayload: Record<string, unknown> | null }
) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row }),
      }),
    }),
    update: (payload: Record<string, unknown>) => {
      capture.updatePayload = payload;
      return {
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { ...row, ...payload } }),
          }),
        }),
      };
    },
  }),
});

void test("admin demo toggle blocks non-admin", async () => {
  const deps: AdminDemoDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminDemoDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminDemoDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminDemoDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const res = await patchAdminDemoResponse(makeRequest({ is_demo: true }), "prop-1", deps);
  assert.equal(res.status, 403);
});

void test("admin can set demo true and clears featured fields", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const property: PropertyRow = {
    id: "prop-1",
    is_demo: false,
    is_featured: true,
    featured_rank: 1,
    featured_until: new Date(Date.now() + 60_000).toISOString(),
  };
  const supabase = buildSupabaseStub(property, capture) as ReturnType<
    AdminDemoDeps["createServerSupabaseClient"]
  >;

  const deps: AdminDemoDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminDemoDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminDemoDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const res = await patchAdminDemoResponse(makeRequest({ is_demo: true }), "prop-1", deps);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.is_demo, true);
  assert.equal(capture.updatePayload?.is_demo, true);
  assert.equal(capture.updatePayload?.is_featured, false);
  assert.equal(capture.updatePayload?.featured_rank, null);
  assert.equal(capture.updatePayload?.featured_until, null);
});

void test("admin can set demo false", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const property: PropertyRow = { id: "prop-1", is_demo: true };
  const supabase = buildSupabaseStub(property, capture) as ReturnType<
    AdminDemoDeps["createServerSupabaseClient"]
  >;

  const deps: AdminDemoDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminDemoDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminDemoDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const res = await patchAdminDemoResponse(makeRequest({ is_demo: false }), "prop-1", deps);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.is_demo, false);
  assert.equal(capture.updatePayload?.is_demo, false);
});

