import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  buildStatusUpdatePayload,
  postAdminSupportRequestStatusResponse,
  type SupportRequestStatusDeps,
} from "@/app/api/admin/support/requests/[id]/status/route";

function makeRequest(status: "new" | "in_progress" | "resolved") {
  return new NextRequest("http://localhost/api/admin/support/requests/req-1/status", {
    method: "POST",
    body: JSON.stringify({ status }),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(id = "req-1") {
  return { params: Promise.resolve({ id }) };
}

void test("buildStatusUpdatePayload maps lifecycle transitions", () => {
  const nowIso = "2026-02-24T10:00:00.000Z";
  const newPayload = buildStatusUpdatePayload("new", {
    nowIso,
    adminUserId: "admin-1",
    row: { id: "req-1", status: "resolved", claimed_by: "admin-2", claimed_at: nowIso, resolved_at: nowIso },
  });
  assert.equal(newPayload.status, "new");
  assert.equal(newPayload.claimed_by, null);
  assert.equal(newPayload.resolved_at, null);

  const inProgressPayload = buildStatusUpdatePayload("in_progress", {
    nowIso,
    adminUserId: "admin-1",
    row: { id: "req-1", status: "new", claimed_by: null, claimed_at: null, resolved_at: null },
  });
  assert.equal(inProgressPayload.status, "in_progress");
  assert.equal(inProgressPayload.claimed_by, "admin-1");

  const resolvedPayload = buildStatusUpdatePayload("resolved", {
    nowIso,
    adminUserId: "admin-1",
    row: { id: "req-1", status: "in_progress", claimed_by: "admin-1", claimed_at: nowIso, resolved_at: null },
  });
  assert.equal(resolvedPayload.status, "resolved");
  assert.equal(resolvedPayload.resolved_at, nowIso);
});

void test("admin support status route preserves auth failures", async () => {
  const deps: SupportRequestStatusDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<SupportRequestStatusDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => null,
    updateRequest: async () => null,
  };

  const response = await postAdminSupportRequestStatusResponse(
    makeRequest("resolved"),
    makeContext(),
    deps
  );
  assert.equal(response.status, 403);
});

void test("admin support status route updates request status", async () => {
  let receivedPayload: Record<string, unknown> | null = null;
  const deps: SupportRequestStatusDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<SupportRequestStatusDeps["requireRole"]>>,
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
      receivedPayload = payload;
      return {
        id: "req-1",
        status: String(payload.status || "in_progress"),
        claimed_by: String(payload.claimed_by || ""),
        claimed_at: String(payload.claimed_at || ""),
        resolved_at: payload.resolved_at ? String(payload.resolved_at) : null,
      };
    },
  };

  const response = await postAdminSupportRequestStatusResponse(
    makeRequest("in_progress"),
    makeContext(),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(receivedPayload?.status, "in_progress");
  assert.equal(receivedPayload?.claimed_by, "admin-1");
});

void test("admin support status route returns 404 for missing id", async () => {
  const deps: SupportRequestStatusDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<SupportRequestStatusDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-24T10:00:00.000Z"),
    loadRequest: async () => null,
    updateRequest: async () => null,
  };

  const response = await postAdminSupportRequestStatusResponse(
    makeRequest("resolved"),
    makeContext("missing-id"),
    deps
  );
  assert.equal(response.status, 404);
});
