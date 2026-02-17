import test from "node:test";
import assert from "node:assert/strict";
import { resolveServerUser } from "@/lib/auth/server-session";

void test("resolveServerUser prefers getUser directly", async () => {
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-1");
  assert.equal(result.sessionRefreshed, false);
});

void test("resolveServerUser refreshes when session missing", async () => {
  let getUserCalls = 0;
  const supabase = {
    auth: {
      getUser: async () => {
        getUserCalls += 1;
        if (getUserCalls === 1) return { data: { user: null } };
        return { data: { user: { id: "user-2" } } };
      },
      refreshSession: async () => ({
        data: { session: { user: { id: "user-2" } } },
      }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-2");
  assert.equal(result.sessionRefreshed, true);
});

void test("resolveServerUser falls back to getUser", async () => {
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-3" } } }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  } as never;

  const result = await resolveServerUser(supabase);
  assert.equal(result.user?.id, "user-3");
  assert.equal(result.sessionRefreshed, false);
});
