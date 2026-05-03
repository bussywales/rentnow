import test from "node:test";
import assert from "node:assert/strict";
import { postSupportContactResponse, type SupportContactDeps } from "@/app/api/support/contact/route";

function makeRequest(payload: unknown) {
  return new Request("http://localhost/api/support/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

void test("support contact route inserts request when allowed", async () => {
  let inserted: Record<string, unknown> | null = null;
  let notified: Record<string, unknown> | null = null;
  const dbClient = {
    from(table: string) {
      assert.equal(table, "support_requests");
      return {
        insert(payload: Record<string, unknown>) {
          inserted = payload;
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id: "support-1" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const deps: SupportContactDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => dbClient as never,
    createServerSupabaseClient: async () => dbClient as never,
    getServerAuthUser: async () => ({ user: { id: "user-1", email: "tenant@example.com" } }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 19,
      limit: 20,
      scopeKey: "user:user-1",
      source: "memory",
    }),
    notifyAdminsOfSupportTicket: async (input) => {
      notified = input;
      return { ok: true, attempted: 1, sent: 1, skipped: 0 } as const;
    },
  };

  const response = await postSupportContactResponse(
    makeRequest({
      category: "billing",
      message: "I need billing support for a duplicate charge on my account.",
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(inserted?.user_id, "user-1");
  assert.equal(inserted?.email, "tenant@example.com");
  assert.equal(notified?.requestId, "support-1");
  assert.equal(notified?.escalated, false);
});

void test("support contact route returns 429 when rate limit is exceeded", async () => {
  const deps: SupportContactDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    createServerSupabaseClient: async () => ({}) as never,
    getServerAuthUser: async () => ({ user: null }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: false,
      retryAfterSeconds: 25,
      remaining: 0,
      limit: 10,
      scopeKey: "anon:test",
      source: "memory",
    }),
  };

  const response = await postSupportContactResponse(
    makeRequest({
      category: "general",
      email: "guest@example.com",
      message: "Need support follow-up for an issue with property details.",
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.retryAfterSeconds, 25);
});

void test("support contact route accepts standard email formats when provided", async () => {
  let inserted: Record<string, unknown> | null = null;
  const dbClient = {
    from(table: string) {
      assert.equal(table, "support_requests");
      return {
        insert(payload: Record<string, unknown>) {
          inserted = payload;
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id: "support-2" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const deps: SupportContactDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => dbClient as never,
    createServerSupabaseClient: async () => dbClient as never,
    getServerAuthUser: async () => ({ user: null }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 19,
      limit: 20,
      scopeKey: "anon:test",
      source: "memory",
    }),
    notifyAdminsOfSupportTicket: async () => ({ ok: true, attempted: 1, sent: 1, skipped: 0 }) as const,
  };

  const response = await postSupportContactResponse(
    makeRequest({
      category: "general",
      email: "test.user+bootcamp@example.co.uk",
      message: "Bootcamp live closure test. Please ignore as a real lead.",
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(inserted?.email, "test.user+bootcamp@example.co.uk");
});
