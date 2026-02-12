import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  patchAdminFeaturedRequestResponse,
  type AdminFeaturedRequestRouteDeps,
} from "@/app/api/admin/featured/requests/[id]/route";

type RequestRow = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

function makeRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/featured/requests/req-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makeDeps(input: {
  row: RequestRow | null;
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  capture?: { rpcPayload: Record<string, unknown> | null; rpcCalls: number };
}): AdminFeaturedRequestRouteDeps {
  const capture = input.capture ?? { rpcPayload: null as Record<string, unknown> | null, rpcCalls: 0 };

  const serviceClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: input.row, error: null }),
        }),
      }),
    }),
    rpc: async (_name: string, payload: Record<string, unknown>) => {
      capture.rpcCalls += 1;
      capture.rpcPayload = payload;
      return { data: input.rpcResult ?? [{ id: "req-1", status: "approved" }], error: input.rpcError ?? null };
    },
  };

  return {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      (serviceClient as unknown as ReturnType<AdminFeaturedRequestRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "admin-1" } as User,
        role: "admin",
        supabase: serviceClient,
      }) as Awaited<ReturnType<AdminFeaturedRequestRouteDeps["requireRole"]>>,
  };
}

void test("admin featured request route blocks non-pending transitions", async () => {
  const capture = { rpcPayload: null as Record<string, unknown> | null, rpcCalls: 0 };
  const deps = makeDeps({
    row: { id: "req-1", status: "approved" },
    capture,
  });

  const response = await patchAdminFeaturedRequestResponse(
    makeRequest({ action: "approve", durationDays: 7 }),
    "req-1",
    deps
  );

  assert.equal(response.status, 409);
  assert.equal(capture.rpcCalls, 0);
});

void test("admin featured request approve sets featured fields via rpc", async () => {
  const capture = { rpcPayload: null as Record<string, unknown> | null, rpcCalls: 0 };
  const deps = makeDeps({
    row: { id: "req-1", status: "pending" },
    capture,
  });

  const response = await patchAdminFeaturedRequestResponse(
    makeRequest({ action: "approve", durationDays: 30, featuredRank: 2, adminNote: "Approved" }),
    "req-1",
    deps
  );

  assert.equal(response.status, 200);
  assert.equal(capture.rpcCalls, 1);
  assert.equal(capture.rpcPayload?.p_request_id, "req-1");
  assert.equal(capture.rpcPayload?.p_action, "approve");
  assert.equal(capture.rpcPayload?.p_duration_days, 30);
  assert.equal(capture.rpcPayload?.p_featured_rank, 2);
  assert.equal(capture.rpcPayload?.p_admin_user_id, "admin-1");
});

void test("admin featured request reject requires reason", async () => {
  const deps = makeDeps({
    row: { id: "req-1", status: "pending" },
  });

  const response = await patchAdminFeaturedRequestResponse(
    makeRequest({ action: "reject", adminNote: "   " }),
    "req-1",
    deps
  );

  assert.equal(response.status, 422);
});

void test("admin featured request route blocks non-admin", async () => {
  const deps: AdminFeaturedRequestRouteDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({} as ReturnType<AdminFeaturedRequestRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminFeaturedRequestRouteDeps["requireRole"]>>,
  };

  const response = await patchAdminFeaturedRequestResponse(
    makeRequest({ action: "approve", durationDays: 7 }),
    "req-1",
    deps
  );

  assert.equal(response.status, 403);
});
