import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postAdminSupportRequestClaimResponse,
  type SupportRequestClaimDeps,
} from "@/app/api/admin/support/requests/[id]/claim/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/support/requests/req-1/claim", {
    method: "POST",
  });
}

function makeContext(id = "req-1") {
  return { params: Promise.resolve({ id }) };
}

void test("admin support claim route preserves auth failures", async () => {
  const deps: SupportRequestClaimDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<SupportRequestClaimDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => null,
    updateRequest: async () => null,
  };

  const response = await postAdminSupportRequestClaimResponse(makeRequest(), makeContext(), deps);
  assert.equal(response.status, 403);
});

void test("admin support claim route sets claimed fields and transitions new to in_progress", async () => {
  let updatedPayload: Record<string, unknown> | null = null;
  const deps: SupportRequestClaimDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<SupportRequestClaimDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => ({
      id: "req-1",
      status: "new",
      claimed_by: null,
      claimed_at: null,
      resolved_at: null,
    }),
    updateRequest: async (_client, _id, payload) => {
      updatedPayload = payload;
      return {
        id: "req-1",
        status: String(payload.status || "in_progress"),
        claimed_by: String(payload.claimed_by || ""),
        claimed_at: String(payload.claimed_at || ""),
        resolved_at: null,
      };
    },
  };

  const response = await postAdminSupportRequestClaimResponse(makeRequest(), makeContext(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.alreadyClaimed, false);
  assert.equal(updatedPayload?.status, "in_progress");
  assert.equal(updatedPayload?.claimed_by, "admin-1");
});

void test("admin support claim route is idempotent for same admin", async () => {
  const deps: SupportRequestClaimDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<SupportRequestClaimDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => ({
      id: "req-1",
      status: "in_progress",
      claimed_by: "admin-1",
      claimed_at: "2026-02-24T09:00:00.000Z",
      resolved_at: null,
    }),
    updateRequest: async () => {
      throw new Error("should not update when already claimed by same admin");
    },
  };

  const response = await postAdminSupportRequestClaimResponse(makeRequest(), makeContext(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.alreadyClaimed, true);
});

void test("admin support claim route blocks claim when already claimed by another admin", async () => {
  const deps: SupportRequestClaimDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-2" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<SupportRequestClaimDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => ({
      id: "req-1",
      status: "in_progress",
      claimed_by: "admin-1",
      claimed_at: "2026-02-24T09:00:00.000Z",
      resolved_at: null,
    }),
    updateRequest: async () => null,
  };

  const response = await postAdminSupportRequestClaimResponse(makeRequest(), makeContext(), deps);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, "already_claimed");
});
