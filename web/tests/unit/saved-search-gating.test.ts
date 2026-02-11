import test from "node:test";
import assert from "node:assert/strict";

import { postSavedSearchResponse } from "../../app/api/saved-searches/route";
import { getTenantPlanForTier, isSavedSearchLimitReached } from "../../lib/plans";

function createSupabaseStub(input: { count: number; planTier?: string | null }) {
  const eqCalls: Array<[string, unknown]> = [];
  const inserted: Array<Record<string, unknown>> = [];
  const existing = Array.from({ length: input.count }).map((_, index) => ({
    id: `search-${index + 1}`,
    user_id: "user-1",
    name: `Search ${index + 1}`,
    query_params: { city: `City ${index + 1}` },
    is_active: true,
    created_at: new Date().toISOString(),
    last_notified_at: null,
    last_checked_at: null,
  }));

  const savedSearchesTable = {
    select: () => ({
      eq: (column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return {
          order: async () => ({ data: existing, error: null }),
        };
      },
    }),
    insert: (payload: Record<string, unknown>) => {
      inserted.push(payload);
      const row = {
        id: `search-${existing.length + 1}`,
        user_id: String(payload.user_id || "user-1"),
        name: String(payload.name || "Followed search"),
        query_params: (payload.query_params as Record<string, unknown>) || {},
        is_active: payload.is_active !== false,
        created_at: new Date().toISOString(),
        last_notified_at: null,
        last_checked_at: null,
      };
      existing.unshift(row);
      return {
        select: () => ({
          maybeSingle: async () => ({
            data: row,
            error: null,
          }),
        }),
      };
    },
    update: (payload: Record<string, unknown>) => ({
      eq: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => {
              const row = existing[0];
              if (!row) return { data: null, error: { message: "missing row" } };
              const updated = { ...row, ...payload };
              return { data: updated, error: null };
            },
          }),
        }),
      }),
    }),
  };

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
        return savedSearchesTable;
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
      body: JSON.stringify({ name: "Test search", filters: { city: "Lagos" } }),
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
      body: JSON.stringify({ name: "Test search", filters: { city: "Lagos" } }),
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

void test("landlord can follow searches without tenant plan limits", async () => {
  const { supabase, inserted } = createSupabaseStub({ count: 0 });
  const response = await postSavedSearchResponse(
    new Request("http://localhost/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test search", filters: { city: "Lagos" } }),
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
