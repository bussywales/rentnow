import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getPropertyRequestAlertSubscriptionsResponse,
  postPropertyRequestAlertSubscriptionsResponse,
} from "@/app/api/requests/alert-subscriptions/route";
import { deletePropertyRequestAlertSubscriptionResponse } from "@/app/api/requests/alert-subscriptions/[id]/route";
import type { PropertyRequestAlertSubscriptionRecord } from "@/lib/requests/property-request-alert-subscriptions";

const baseRow: PropertyRequestAlertSubscriptionRecord = {
  id: "sub-1",
  user_id: "user-1",
  role: "agent",
  market_code: "NG",
  intent: "rent",
  property_type: "apartment",
  city: "Lagos",
  bedrooms_min: 2,
  is_active: true,
  created_at: "2026-04-30T12:00:00.000Z",
  updated_at: "2026-04-30T12:00:00.000Z",
};

function createAuthOk() {
  return {
    ok: true as const,
    user: { id: "user-1" } as User,
    supabase: {} as never,
  };
}

void test("request alert subscriptions list requires auth", async () => {
  const response = await getPropertyRequestAlertSubscriptionsResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions"),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }) as Awaited<ReturnType<typeof createAuthOk>>,
      getUserRole: async () => "agent",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );

  assert.equal(response.status, 401);
});

void test("request alert subscriptions list returns empty payload for ineligible roles", async () => {
  const response = await getPropertyRequestAlertSubscriptionsResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions"),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: async () => createAuthOk(),
      getUserRole: async () => "tenant",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.eligible, false);
  assert.deepEqual(json.items, []);
});

void test("request alert subscriptions create saves a new eligible subscription", async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const response = await postPropertyRequestAlertSubscriptionsResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketCode: "NG",
        intent: "rent",
        propertyType: "apartment",
        city: "Lagos",
        bedroomsMin: 2,
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () =>
        ({
          from(table: string) {
            assert.equal(table, "property_request_alert_subscriptions");
            return {
              select() {
                return {
                  eq() {
                    return this;
                  },
                  order() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
              insert(row: Record<string, unknown>) {
                inserted.push(row);
                return {
                  select() {
                    return {
                      single() {
                        return Promise.resolve({ data: baseRow, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        }) as never,
      requireUser: async () => createAuthOk(),
      getUserRole: async () => "agent",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );
  const json = await response.json();

  assert.equal(response.status, 201);
  assert.equal(inserted[0]?.role, "agent");
  assert.equal(inserted[0]?.market_code, "NG");
  assert.equal(json.subscription.marketCode, "NG");
});

void test("request alert subscriptions create rejects ineligible roles", async () => {
  const response = await postPropertyRequestAlertSubscriptionsResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketCode: "NG" }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: async () => createAuthOk(),
      getUserRole: async () => "tenant",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );

  assert.equal(response.status, 403);
});

void test("request alert subscriptions delete deactivates owned subscription", async () => {
  const response = await deletePropertyRequestAlertSubscriptionResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions/sub-1", {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: "sub-1" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () =>
        ({
          from(table: string) {
            assert.equal(table, "property_request_alert_subscriptions");
            return {
              update(payload: Record<string, unknown>) {
                assert.equal(payload.is_active, false);
                return {
                  eq() {
                    return this;
                  },
                  select() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: { ...baseRow, is_active: false },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        }) as never,
      requireUser: async () => createAuthOk(),
      getUserRole: async () => "agent",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.id, "sub-1");
});

void test("request alert subscriptions create reactivates an inactive duplicate subscription", async () => {
  const updated: Array<Record<string, unknown>> = [];
  const response = await postPropertyRequestAlertSubscriptionsResponse(
    new NextRequest("http://localhost/api/requests/alert-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketCode: "NG",
        intent: "rent",
        propertyType: "apartment",
        city: "Lagos",
        bedroomsMin: 2,
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () =>
        ({
          from(table: string) {
            assert.equal(table, "property_request_alert_subscriptions");
            return {
              select() {
                return {
                  eq() {
                    return this;
                  },
                  order() {
                    return Promise.resolve({
                      data: [{ ...baseRow, is_active: false }],
                      error: null,
                    });
                  },
                };
              },
              update(row: Record<string, unknown>) {
                updated.push(row);
                return {
                  eq() {
                    return this;
                  },
                  select() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: { ...baseRow, is_active: true },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        }) as never,
      requireUser: async () => createAuthOk(),
      getUserRole: async () => "agent",
      logProductAnalyticsEvent: async () => ({ ok: true }),
    }
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(updated[0]?.is_active, true);
  assert.equal(json.subscription.isActive, true);
  assert.equal(json.created, true);
});
