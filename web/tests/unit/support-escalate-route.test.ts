import test from "node:test";
import assert from "node:assert/strict";
import {
  postSupportEscalateResponse,
  type SupportEscalateDeps,
} from "@/app/api/support/escalate/route";
import { buildSupportEscalationEmail } from "@/lib/email/templates/support-escalation";

function makeRequest(payload: unknown) {
  return new Request("http://localhost/api/support/escalate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

void test("support escalate route creates request row and sends email", async () => {
  let insertedPayload: Record<string, unknown> | null = null;
  let emailPayload: Record<string, unknown> | null = null;
  let notifiedPayload: Record<string, unknown> | null = null;

  const dbClient = {
    from(table: string) {
      assert.equal(table, "support_requests");
      return {
        insert(row: Record<string, unknown>) {
          insertedPayload = row;
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id: "req_123" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const deps: SupportEscalateDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => dbClient as never,
    createServiceRoleClient: () => dbClient as never,
    getServerAuthUser: async () =>
      ({
        user: { id: "user-1", email: "tenant@example.com" },
        supabase: {
          from() {
            return {
              select() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: { full_name: "Tenant User", role: "tenant" } };
                      },
                    };
                  },
                };
              },
            };
          },
        },
      }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 19,
      limit: 20,
      scopeKey: "user:user-1",
      source: "memory",
    }),
    notifyAdminsOfSupportTicket: async (input) => {
      notifiedPayload = input;
      return { ok: true, attempted: 2, sent: 2, skipped: 0 } as const;
    },
    now: () => new Date("2026-02-23T15:00:00.000Z"),
    sendSupportEscalationEmail: async (input) => {
      emailPayload = input;
      return { ok: true };
    },
  };

  const response = await postSupportEscalateResponse(
    makeRequest({
      category: "billing",
      message: "Charged but no booking confirmation shown in trips.",
      pageUrl: "https://www.propatyhub.com/trips",
      aiTranscript: [{ role: "user", content: "charged but no booking" }],
      escalationReason: "charged_without_booking_no_doc_match",
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.requestId, "req_123");
  assert.equal(insertedPayload?.category, "billing");
  assert.equal(insertedPayload?.user_id, "user-1");
  assert.equal(insertedPayload?.email, "tenant@example.com");
  assert.equal(typeof insertedPayload?.metadata, "object");
  assert.equal(emailPayload?.requestId, "req_123");
  assert.equal(notifiedPayload?.requestId, "req_123");
  assert.equal(notifiedPayload?.escalated, true);
});

void test("support escalate route requires email when unauthenticated", async () => {
  const deps: SupportEscalateDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({
        from() {
          return {
            insert() {
              return {
                select() {
                  return {
                    async maybeSingle() {
                      return { data: { id: "unused" }, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      }) as never,
    createServiceRoleClient: () => ({}) as never,
    getServerAuthUser: async () =>
      ({
        user: null,
        supabase: {
          from() {
            return {
              select() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: null };
                      },
                    };
                  },
                };
              },
            };
          },
        },
      }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 4,
      limit: 5,
      scopeKey: "anon:test",
      source: "memory",
    }),
    now: () => new Date("2026-02-23T15:00:00.000Z"),
    sendSupportEscalationEmail: async () => ({ ok: true }),
  };

  const response = await postSupportEscalateResponse(
    makeRequest({
      category: "general",
      message: "Need manual support follow-up please.",
    }),
    deps
  );

  assert.equal(response.status, 400);
});

void test("support escalate route returns 429 when rate limit is exceeded", async () => {
  const deps: SupportEscalateDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    getServerAuthUser: async () =>
      ({
        user: null,
        supabase: {
          from() {
            return {
              select() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: null };
                      },
                    };
                  },
                };
              },
            };
          },
        },
      }) as never,
    enforceSupportRateLimit: async () => ({
      allowed: false,
      retryAfterSeconds: 42,
      remaining: 0,
      limit: 5,
      scopeKey: "anon:test",
      source: "memory",
    }),
    now: () => new Date("2026-02-23T15:00:00.000Z"),
    sendSupportEscalationEmail: async () => ({ ok: true }),
  };

  const response = await postSupportEscalateResponse(
    makeRequest({
      category: "general",
      email: "guest@example.com",
      message: "Need help; this is my escalated issue description.",
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.retryAfterSeconds, 42);
});


void test("support escalation email copy is unmistakably classified", () => {
  const email = buildSupportEscalationEmail({
    requestId: "req_123",
    category: "billing",
    role: "tenant",
    name: "Tenant User",
    email: "tenant@example.com",
    message: "Charged but no booking confirmation shown in trips.",
    metadata: { escalationReason: "charged_without_booking_no_doc_match" },
  });

  assert.match(email.subject, /\[SUPPORT ESCALATION\]/);
  assert.match(email.html, /Support escalation received/);
  assert.match(email.html, />Escalated</);
  assert.match(email.html, /needs support triage\./);
});
