import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getWorkspaceActivityResponse,
  type WorkspaceActivityRouteDeps,
} from "@/app/api/workspace/activity/route";

function makeRequest(path = "/api/workspace/activity") {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

void test("workspace activity route preserves auth failures", async () => {
  const deps: WorkspaceActivityRouteDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<WorkspaceActivityRouteDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    getWorkspaceActivityFeed: async () => [],
  };

  const response = await getWorkspaceActivityResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("workspace activity route enforces allowed roles and returns feed payload", async () => {
  let capturedLimit: number | undefined;
  let capturedRole: string | null = null;
  const deps: WorkspaceActivityRouteDeps = {
    requireRole: async ({ roles }) => {
      assert.deepEqual(roles, ["agent", "landlord", "admin"]);
      return {
        ok: true,
        role: "agent",
        user: { id: "agent-1" } as never,
        supabase: {} as never,
      } as Awaited<ReturnType<WorkspaceActivityRouteDeps["requireRole"]>>;
    },
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getWorkspaceActivityFeed: async (input) => {
      capturedLimit = input.limit;
      capturedRole = input.role;
      return [
        {
          id: "lead:1",
          type: "lead_received",
          title: "New lead received",
          subtitle: "Listing A",
          createdAt: "2026-02-24T10:00:00.000Z",
          href: "/host/leads",
          badge: "New",
        },
      ];
    },
  };

  const response = await getWorkspaceActivityResponse(
    makeRequest("/api/workspace/activity?limit=9"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.count, 1);
  assert.equal(Array.isArray(body.items), true);
  assert.equal(body.items[0].type, "lead_received");
  assert.equal(capturedLimit, 9);
  assert.equal(capturedRole, "agent");
});
