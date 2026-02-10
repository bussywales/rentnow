import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postAdminFeaturedResponse,
  type AdminFeaturedDeps,
} from "@/app/api/admin/properties/[id]/featured/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/properties/prop-1/featured", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

type PropertyRow = {
  id: string;
  is_demo?: boolean | null;
  is_featured?: boolean | null;
  featured_rank?: number | null;
  featured_until?: string | null;
  featured_at?: string | null;
  featured_by?: string | null;
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

void test("admin can feature and unfeature a property", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const property: PropertyRow = { id: "prop-1", is_featured: false };
  const supabase = buildSupabaseStub(property, capture) as ReturnType<
    AdminFeaturedDeps["createServerSupabaseClient"]
  >;

  const deps: AdminFeaturedDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminFeaturedDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminFeaturedDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const res = await postAdminFeaturedResponse(
    makeRequest({ is_featured: true, featured_rank: 1, featured_until: future }),
    "prop-1",
    deps
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.is_featured, true);
  assert.equal(json.featured_rank, 1);
  assert.equal(json.featured_until, future);
  assert.equal(capture.updatePayload?.is_featured, true);
  assert.equal(capture.updatePayload?.featured_rank, 1);
  assert.equal(capture.updatePayload?.featured_until, future);
  assert.equal(capture.updatePayload?.featured_by, "admin-1");

  const resOff = await postAdminFeaturedResponse(
    makeRequest({ is_featured: false }),
    "prop-1",
    deps
  );
  assert.equal(resOff.status, 200);
  const jsonOff = await resOff.json();
  assert.equal(jsonOff.is_featured, false);
  assert.equal(jsonOff.featured_rank, null);
  assert.equal(jsonOff.featured_until, null);
});

void test("non-admin cannot feature property", async () => {
  const deps: AdminFeaturedDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminFeaturedDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminFeaturedDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminFeaturedDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const res = await postAdminFeaturedResponse(
    makeRequest({ is_featured: true, featured_rank: 1 }),
    "prop-1",
    deps
  );
  assert.equal(res.status, 403);
});

void test("admin cannot feature a demo property", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const property: PropertyRow = { id: "prop-1", is_featured: false, is_demo: true };
  const supabase = buildSupabaseStub(property, capture) as ReturnType<
    AdminFeaturedDeps["createServerSupabaseClient"]
  >;

  const deps: AdminFeaturedDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminFeaturedDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminFeaturedDeps["requireRole"]>>,
    logFailure: () => undefined,
  };

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const res = await postAdminFeaturedResponse(
    makeRequest({ is_featured: true, featured_rank: 1, featured_until: future }),
    "prop-1",
    deps
  );
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.error, "Demo listings can't be featured.");
  assert.equal(capture.updatePayload, null);
});
