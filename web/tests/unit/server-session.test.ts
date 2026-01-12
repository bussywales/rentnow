import test from "node:test";
import assert from "node:assert/strict";
import { resolveServerUser } from "@/lib/auth/server-session";

void test("resolveServerUser prefers existing session user", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
      refreshSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-1");
  assert.equal(result.sessionRefreshed, false);
});

void test("resolveServerUser refreshes when session missing", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      refreshSession: async () => ({
        data: { session: { user: { id: "user-2" } } },
      }),
      getUser: async () => ({ data: { user: null } }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-2");
  assert.equal(result.sessionRefreshed, true);
});

void test("resolveServerUser falls back to getUser", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      refreshSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: { id: "user-3" } } }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-3");
  assert.equal(result.sessionRefreshed, false);
});
