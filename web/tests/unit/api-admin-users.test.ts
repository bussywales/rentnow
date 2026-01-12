import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { getAdminUsersResponse, postAdminUsersResponse } from "../../app/api/admin/users/route";

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

void test("admin users API sends password reset email for admins", async () => {
  let resetCalled = false;
  let receivedRedirect: string | null = null;

  const response = await postAdminUsersResponse(
    new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        action: "reset_password",
        userId: "user-123",
        email: "user@example.com",
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-123" } as never,
        role: "admin" as never,
      }),
      sendResetEmail: async (_email, redirectTo) => {
        resetCalled = true;
        receivedRedirect = redirectTo;
        return { error: null };
      },
    }
  );

  assert.equal(response.status, 200);
  assert.equal(resetCalled, true);
  assert.ok(receivedRedirect?.includes("/auth/reset"));
  const body = await response.json();
  assert.equal(body.ok, true);
});
