import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { getAdminUsersResponse } from "../../app/api/admin/users/route";

void test("admin users API denies non-admin access", async () => {
  let listCalled = false;

  const response = await getAdminUsersResponse(
    new Request("http://localhost/api/admin/users"),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }),
      listUsers: async () => {
        listCalled = true;
        return { data: { users: [] }, error: null };
      },
    }
  );

  assert.equal(response.status, 403);
  assert.equal(listCalled, false);
});

void test("admin users API returns users for admins", async () => {
  const response = await getAdminUsersResponse(
    new Request("http://localhost/api/admin/users"),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-123" } as never,
        role: "admin" as never,
      }),
      listUsers: async () => ({
        data: { users: [{ id: "user-123", email: "admin@example.com" }] },
        error: null,
      }),
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.users.length, 1);
  assert.equal(body.users[0].id, "user-123");
});
