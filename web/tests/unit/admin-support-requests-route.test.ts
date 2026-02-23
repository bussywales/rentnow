import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSupportRequestsResponse,
  type AdminSupportRequestsDeps,
} from "@/app/api/admin/support/requests/route";

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

void test("admin support requests route preserves auth failures", async () => {
  const deps: AdminSupportRequestsDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminSupportRequestsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    loadRows: async () => [],
  };

  const response = await getAdminSupportRequestsResponse(
    makeRequest("/api/admin/support/requests"),
    deps
  );
  assert.equal(response.status, 403);
});

void test("admin support requests route filters open and escalated rows", async () => {
  const deps: AdminSupportRequestsDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSupportRequestsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    loadRows: async () => [
      {
        id: "req-1",
        created_at: "2026-02-23T10:00:00.000Z",
        category: "billing",
        email: "a@example.com",
        name: "A",
        message: "Charged but no booking.",
        status: "new",
        metadata: { escalationReason: "charged_without_booking_no_doc_match", role: "tenant" },
      },
      {
        id: "req-2",
        created_at: "2026-02-23T09:00:00.000Z",
        category: "general",
        email: "b@example.com",
        name: "B",
        message: "Regular help request",
        status: "new",
        metadata: {},
      },
      {
        id: "req-3",
        created_at: "2026-02-23T08:00:00.000Z",
        category: "account",
        email: "c@example.com",
        name: "C",
        message: "Resolved issue",
        status: "resolved",
        metadata: { aiTranscript: [{ role: "user", content: "still not working" }] },
      },
    ],
  };

  const response = await getAdminSupportRequestsResponse(
    makeRequest("/api/admin/support/requests?status=open&escalated=1&limit=10&offset=0"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.filters.status, "open");
  assert.equal(body.filters.escalated, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, "req-1");
  assert.equal(body.items[0].escalated, true);
  assert.equal(body.items[0].role, "tenant");
});

void test("admin support requests route includes resolved rows when status=all", async () => {
  const deps: AdminSupportRequestsDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSupportRequestsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    loadRows: async () => [
      {
        id: "req-1",
        created_at: "2026-02-23T10:00:00.000Z",
        category: "billing",
        email: "a@example.com",
        name: "A",
        message: "Open",
        status: "new",
        metadata: {},
      },
      {
        id: "req-2",
        created_at: "2026-02-23T09:00:00.000Z",
        category: "billing",
        email: "b@example.com",
        name: "B",
        message: "Closed",
        status: "resolved",
        metadata: {},
      },
    ],
  };

  const response = await getAdminSupportRequestsResponse(
    makeRequest("/api/admin/support/requests?status=all"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.items.length, 2);
  assert.equal(body.pagination.total, 2);
});

