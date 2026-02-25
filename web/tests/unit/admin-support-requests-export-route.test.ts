import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSupportRequestsCsvResponse,
  type AdminSupportRequestsCsvDeps,
} from "@/app/api/admin/support/requests/export.csv/route";

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

void test("admin support export route preserves auth failures", async () => {
  const deps: AdminSupportRequestsCsvDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminSupportRequestsCsvDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    loadRows: async () => [],
  };

  const response = await getAdminSupportRequestsCsvResponse(
    makeRequest("/api/admin/support/requests/export.csv"),
    deps
  );
  assert.equal(response.status, 403);
});

void test("admin support export route returns csv headers and filtered rows", async () => {
  const deps: AdminSupportRequestsCsvDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSupportRequestsCsvDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    loadRows: async () => [
      {
        id: "req-1",
        created_at: "2026-02-25T09:00:00.000Z",
        category: "billing",
        email: "first@example.com",
        name: "First",
        message: "Need billing help",
        status: "new",
        metadata: { role: "tenant", escalationReason: "charged_without_booking_no_doc_match" },
        claimed_by: null,
        claimed_at: null,
        resolved_at: null,
      },
      {
        id: "req-2",
        created_at: "2026-02-24T09:00:00.000Z",
        category: "general",
        email: "second@example.com",
        name: "Second",
        message: "General help",
        status: "resolved",
        metadata: { role: "tenant" },
        claimed_by: "admin-2",
        claimed_at: "2026-02-24T09:05:00.000Z",
        resolved_at: "2026-02-24T09:30:00.000Z",
      },
    ],
  };

  const response = await getAdminSupportRequestsCsvResponse(
    makeRequest(
      "/api/admin/support/requests/export.csv?status=open&escalated=1&date_from=2026-02-25"
    ),
    deps
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(
    String(response.headers.get("content-disposition")),
    /attachment; filename="support-requests-/
  );

  const csv = await response.text();
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^id,created_at,status,category,email,name,role,escalated,/);
  assert.match(lines[1], /^req-1,/);
  assert.match(lines[1], /,tenant,yes,/);
  assert.doesNotMatch(lines[1], /req-2/);
});
