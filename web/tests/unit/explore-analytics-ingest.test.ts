import test from "node:test";
import assert from "node:assert/strict";
import { postExploreAnalyticsIngestResponse } from "@/app/api/analytics/explore/route";
import { EXPLORE_ANALYTICS_EVENT_NAMES } from "@/lib/explore/explore-analytics-event-names";

function buildRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request("http://localhost/api/analytics/explore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

void test("explore analytics ingest returns analytics_disabled when kill-switch is off", async () => {
  let inserted = false;
  const response = await postExploreAnalyticsIngestResponse(
    buildRequest({ eventName: "explore_view" }),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          role: "tenant",
          user: { id: "11111111-1111-1111-1111-111111111111" },
          supabase: {
            from: () => ({
              insert: async () => {
                inserted = true;
                return { error: null };
              },
            }),
          },
        }) as never,
      getExploreAnalyticsSettings: async () => ({
        enabled: false,
        consentRequired: false,
        noticeEnabled: true,
      }),
      checkExploreAnalyticsRateLimit: () =>
        ({
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        }) as never,
    }
  );

  assert.equal(response.status, 403);
  const payload = (await response.json()) as { code?: string };
  assert.equal(payload.code, "analytics_disabled");
  assert.equal(inserted, false);
});

void test("explore analytics ingest route allows tenant, agent, and landlord roles", async () => {
  let capturedRoles: string[] | null = null;
  const response = await postExploreAnalyticsIngestResponse(
    buildRequest({ eventName: "explore_view" }),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async ({ roles }) => {
        capturedRoles = [...roles];
        return {
          ok: false,
          response: new Response(null, { status: 401 }),
        } as never;
      },
      getExploreAnalyticsSettings: async () => ({
        enabled: true,
        consentRequired: false,
        noticeEnabled: true,
      }),
      checkExploreAnalyticsRateLimit: () =>
        ({
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        }) as never,
    }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(capturedRoles, ["tenant", "agent", "landlord"]);
});

void test("explore analytics ingest enforces consent header when consent_required is enabled", async () => {
  const response = await postExploreAnalyticsIngestResponse(
    buildRequest({ eventName: "explore_view" }),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          role: "tenant",
          user: { id: "11111111-1111-1111-1111-111111111111" },
          supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
        }) as never,
      getExploreAnalyticsSettings: async () => ({
        enabled: true,
        consentRequired: true,
        noticeEnabled: true,
      }),
      checkExploreAnalyticsRateLimit: () =>
        ({
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        }) as never,
    }
  );

  assert.equal(response.status, 403);
  const payload = (await response.json()) as { code?: string };
  assert.equal(payload.code, "consent_required");
});

void test("explore analytics ingest validates payload shape and rejects unknown keys", async () => {
  const response = await postExploreAnalyticsIngestResponse(
    buildRequest({
      eventName: "explore_view",
      unknown: "field",
    }),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          role: "tenant",
          user: { id: "11111111-1111-1111-1111-111111111111" },
          supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
        }) as never,
      getExploreAnalyticsSettings: async () => ({
        enabled: true,
        consentRequired: false,
        noticeEnabled: true,
      }),
      checkExploreAnalyticsRateLimit: () =>
        ({
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        }) as never,
    }
  );

  assert.equal(response.status, 400);
});

void test("explore analytics ingest stores allowed payload when enabled", async () => {
  let insertedPayload: Record<string, unknown> | null = null;

  const response = await postExploreAnalyticsIngestResponse(
    buildRequest(
      {
        eventName: "explore_swipe",
        sessionId: "session-123",
        listingId: "11111111-1111-4111-8111-111111111111",
        marketCode: "GB",
        intentType: "rent",
        index: 2,
        feedSize: 20,
        trustCueVariant: "none",
        trustCueEnabled: false,
      },
      { "x-explore-analytics-consent": "accepted" }
    ),
    {
      hasServerSupabaseEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          role: "tenant",
          user: { id: "22222222-2222-2222-2222-222222222222" },
          supabase: {
            from: () => ({
              insert: async (payload: Record<string, unknown>) => {
                insertedPayload = payload;
                return { error: null };
              },
            }),
          },
        }) as never,
      getExploreAnalyticsSettings: async () => ({
        enabled: true,
        consentRequired: true,
        noticeEnabled: true,
      }),
      checkExploreAnalyticsRateLimit: () =>
        ({
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        }) as never,
    }
  );

  assert.equal(response.status, 201);
  assert.equal(insertedPayload?.event_name, "explore_swipe");
  assert.equal(insertedPayload?.market_code, "GB");
  assert.equal(insertedPayload?.trust_cue_variant, "none");
  assert.equal(insertedPayload?.trust_cue_enabled, false);
  assert.equal(insertedPayload?.user_id, "22222222-2222-2222-2222-222222222222");
});

void test("explore analytics ingest accepts all explore-v2 events in the shared allowlist", async () => {
  const insertedEventNames: string[] = [];
  const exploreV2EventNames = EXPLORE_ANALYTICS_EVENT_NAMES.filter((eventName) => eventName.startsWith("explore_v2"));

  for (const eventName of exploreV2EventNames) {
    const response = await postExploreAnalyticsIngestResponse(
      buildRequest(
        {
          eventName,
          listingId: "33333333-3333-4333-8333-333333333333",
          marketCode: "NG",
          intentType: "rent",
        },
        { "x-explore-analytics-consent": "accepted" }
      ),
      {
        hasServerSupabaseEnv: () => true,
        requireRole: async () =>
          ({
            ok: true,
            role: "tenant",
            user: { id: "44444444-4444-4444-4444-444444444444" },
            supabase: {
              from: () => ({
                insert: async (payload: Record<string, unknown>) => {
                  insertedEventNames.push(String(payload.event_name ?? ""));
                  return { error: null };
                },
              }),
            },
          }) as never,
        getExploreAnalyticsSettings: async () => ({
          enabled: true,
          consentRequired: true,
          noticeEnabled: true,
        }),
        checkExploreAnalyticsRateLimit: () =>
          ({
            allowed: true,
            retryAfterSeconds: 0,
            remaining: 59,
            limit: 60,
            resetAt: Date.now() + 60_000,
          }) as never,
      }
    );
    assert.equal(response.status, 201);
  }

  assert.deepEqual(insertedEventNames, exploreV2EventNames);
});
