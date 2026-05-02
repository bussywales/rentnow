import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { postAdminUserRoleResponse } from "@/app/api/admin/users/role/route";

void test("admin user role route requires admin access", async () => {
  const response = await postAdminUserRoleResponse(
    new Request("http://localhost/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        role: "agent",
        reason: "Correcting role",
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        }) as never,
    }
  );

  assert.equal(response.status, 403);
});

void test("admin user role route rejects whitespace-only reasons", async () => {
  const response = await postAdminUserRoleResponse(
    new Request("http://localhost/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        role: "agent",
        reason: "   ",
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      createServiceRoleClient: () => ({}) as never,
    }
  );

  assert.equal(response.status, 400);
});

void test("admin user role route returns no_change when role and onboarding state already match", async () => {
  const response = await postAdminUserRoleResponse(
    new Request("http://localhost/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        role: "agent",
        reason: "Confirmed correct role",
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      createServiceRoleClient: () =>
        ({
          from(table: string) {
            assert.equal(table, "profiles");
            return {
              select() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: { role: "agent", onboarding_completed: true },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, status: "no_change" });
});

void test("admin user role route updates role, completes onboarding, and writes audit log", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];

  const response = await postAdminUserRoleResponse(
    new Request("http://localhost/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        role: "landlord",
        reason: "Correct initial role selection",
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      createServiceRoleClient: () =>
        ({
          from(table: string) {
            if (table === "profiles") {
              return {
                select() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: { role: "tenant", onboarding_completed: false },
                          error: null,
                        }),
                      };
                    },
                  };
                },
                update(payload: Record<string, unknown>) {
                  updates.push(payload);
                  return {
                    eq: async () => ({ error: null }),
                  };
                },
              };
            }
            if (table === "role_change_audit") {
              return {
                insert(payload: Record<string, unknown>) {
                  audits.push(payload);
                  return Promise.resolve({ error: null });
                },
              };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        }) as never,
      logAdminRoleChanged: (input) => {
        logs.push(input);
      },
    }
  );

  assert.equal(response.status, 200);
  assert.equal(updates[0]?.role, "landlord");
  assert.equal(updates[0]?.onboarding_completed, true);
  assert.equal(typeof updates[0]?.onboarding_completed_at, "string");
  assert.equal(audits[0]?.old_role, "tenant");
  assert.equal(audits[0]?.new_role, "landlord");
  assert.equal(audits[0]?.reason, "Correct initial role selection");
  assert.equal(logs[0]?.targetProfileId, "550e8400-e29b-41d4-a716-446655440000");
});
