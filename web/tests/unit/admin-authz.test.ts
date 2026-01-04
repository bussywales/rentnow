import test from "node:test";
import assert from "node:assert/strict";

import { requireRole } from "../../lib/authz";

type MockSupabase = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
  };
  from: () => {
    select: () => {
      eq: () => {
        maybeSingle: () => Promise<{ data: { role: string | null } | null }>;
      };
    };
  };
};

function createMockSupabase(role: string | null): MockSupabase {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role } }),
        }),
      }),
    }),
  };
}

void test("requireRole allows admin access", async () => {
  const result = await requireRole({
    request: new Request("http://localhost/admin"),
    route: "/api/admin/users",
    startTime: Date.now(),
    roles: ["admin"],
    supabase: createMockSupabase("admin") as unknown as Parameters<typeof requireRole>[0]["supabase"],
  });

  assert.equal(result.ok, true);
});

void test("requireRole rejects non-admin access", async () => {
  const result = await requireRole({
    request: new Request("http://localhost/admin"),
    route: "/api/admin/users",
    startTime: Date.now(),
    roles: ["admin"],
    supabase: createMockSupabase("tenant") as unknown as Parameters<typeof requireRole>[0]["supabase"],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 403);
  }
});
