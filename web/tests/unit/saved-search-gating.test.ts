import test from "node:test";
import assert from "node:assert/strict";

import { postSavedSearchResponse } from "../../app/api/saved-searches/route";
import { getTenantPlanForTier, isSavedSearchLimitReached } from "../../lib/plans";

type QueryResult = { count?: number | null; error?: { message: string } | null };

function createThenable(result: QueryResult) {
  return {
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
}

function createSupabaseStub(input: { count: number; planTier?: string | null }) {
  const eqCalls: Array<[string, unknown]> = [];
  const inserted: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table === "profile_plans") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { plan_tier: input.planTier ?? "free", valid_until: null },
          }),
        };
        return query;
      }
      if (table === "saved_searches") {
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              eqCalls.push([column, value]);
              return createThenable({ count: input.count, error: null });
            },
          }),
          insert: (payload: Record<string, unknown>) => {
            inserted.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "search-1", ...payload },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return { supabase, eqCalls, inserted };
}

void test("tenant with zero saved searches can create a saved search", async () => {
  const { supabase, eqCalls, inserted } = createSupabaseStub({ count: 0 });
  const response = await postSavedSearchResponse(
    new Request("http://localhost/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test search", query_params: { city: "Lagos" } }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => supabase as never,
      requireUser: async () => ({ ok: true, user: { id: "user-1" }, supabase } as never),
      getUserRole: async () => "tenant",
      getTenantPlanForTier,
      isSavedSearchLimitReached,
      logFailure: () => undefined,
      logSavedSearchLimitHit: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.search);
  assert.deepEqual(eqCalls, [["user_id", "user-1"]]);
  assert.equal(inserted[0]?.user_id, "user-1");
});

void test("tenant exceeding limit is blocked with limit_reached", async () => {
  const { supabase } = createSupabaseStub({ count: 1 });
  const response = await postSavedSearchResponse(
    new Request("http://localhost/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test search", query_params: { city: "Lagos" } }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => supabase as never,
      requireUser: async () => ({ ok: true, user: { id: "user-1" }, supabase } as never),
      getUserRole: async () => "tenant",
      getTenantPlanForTier: () => ({
        name: "Free",
        tier: "free",
        maxSavedSearches: 1,
        instantAlerts: false,
        earlyAccessMinutes: 0,
      }),
      isSavedSearchLimitReached,
      logFailure: () => undefined,
      logSavedSearchLimitHit: () => undefined,
    }
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "limit_reached");
});

void test("landlord is blocked from saving searches", async () => {
  const { supabase, inserted } = createSupabaseStub({ count: 0 });
  const response = await postSavedSearchResponse(
    new Request("http://localhost/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test search", query_params: { city: "Lagos" } }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => supabase as never,
      requireUser: async () => ({ ok: true, user: { id: "user-1" }, supabase } as never),
      getUserRole: async () => "landlord",
      logFailure: () => undefined,
      logSavedSearchLimitHit: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.search);
  assert.equal(inserted[0]?.user_id, "user-1");
});
