import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  postAdminAlertsTestResponse,
  type AdminAlertsTestDeps,
} from "@/app/api/admin/alerts/test/route";

void test("admin alerts test route does not mutate saved search alert state", async () => {
  const fromCalls: string[] = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit: async () => ({ data: [], error: null }),
  };

  let sentTo: string | null = null;
  const deps: AdminAlertsTestDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      ({
        from: (table: string) => {
          fromCalls.push(table);
          return query;
        },
      }) as never,
    requireRole: async () =>
      ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1", email: "admin@example.com" } as never,
        role: "admin",
      }) as Awaited<ReturnType<AdminAlertsTestDeps["requireRole"]>>,
    getNow: () => new Date("2026-02-12T10:00:00.000Z"),
    getSiteUrl: async () => "https://www.propatyhub.com",
    sendEmail: async ({ to }) => {
      sentTo = to;
      return { ok: true };
    },
  };

  const response = await postAdminAlertsTestResponse(
    new NextRequest("http://localhost/api/admin/alerts/test", { method: "POST" }),
    deps
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(sentTo, "admin@example.com");
  assert.ok(fromCalls.includes("saved_searches"));
  assert.equal(fromCalls.includes("saved_search_alerts"), false);
});

