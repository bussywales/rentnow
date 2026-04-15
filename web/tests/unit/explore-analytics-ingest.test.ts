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

function buildDeps(overrides: Record<string, unknown> = {}) {
  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null } }),
        },
      }) as never,
    createServiceRoleClient: () =>
      ({
        from: () => ({
          insert: async () => ({ error: null }),
        }),
      }) as never,
    fetchUserRole: async () => null,
    getExploreAnalyticsSettings: async () => ({
      enabled: true,
      consentRequired: false,
      noticeEnabled: true,
    }),
    checkExploreAnalyticsRateLimit: async () =>
      ({
        allowed: true,
        retryAfterSeconds: 0,
        remaining: 59,
        limit: 60,
        resetAt: Date.now() + 60_000,
      }) as never,
    ...overrides,
  };
}

void test("explore analytics ingest returns analytics_disabled when kill-switch is off", async () => {
  let inserted = false;
  const response = await postExploreAnalyticsIngestResponse(buildRequest({ eventName: "explore_view" }), buildDeps({
    getExploreAnalyticsSettings: async () => ({
      enabled: false,
      consentRequired: false,
      noticeEnabled: true,
    }),
    createServiceRoleClient: () =>
      ({
        from: () => ({
          insert: async () => {
            inserted = true;
            return { error: null };
          },
        }),
      }) as never,
  }));

  assert.equal(response.status, 403);
  const payload = (await response.json()) as { code?: string };
  assert.equal(payload.code, "analytics_disabled");
  assert.equal(inserted, false);
});

void test("explore analytics settings consent still blocks ingest when required", async () => {
  const response = await postExploreAnalyticsIngestResponse(buildRequest({ eventName: "explore_view" }), buildDeps({
    getExploreAnalyticsSettings: async () => ({
      enabled: true,
      consentRequired: true,
      noticeEnabled: true,
    }),
  }));

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
    buildDeps()
  );

  assert.equal(response.status, 400);
});

void test("explore analytics ingest accepts anonymous traffic and stores null user_id", async () => {
  let insertedPayload: Record<string, unknown> | null = null;
  let rateLimitInput: Record<string, unknown> | null = null;

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
        ctaCopyVariant: "clarity",
      },
      { "x-explore-analytics-consent": "accepted" }
    ),
    buildDeps({
      getExploreAnalyticsSettings: async () => ({
        enabled: true,
        consentRequired: true,
        noticeEnabled: true,
      }),
      createServiceRoleClient: () =>
        ({
          from: () => ({
            insert: async (payload: Record<string, unknown>) => {
              insertedPayload = payload;
              return { error: null };
            },
          }),
        }) as never,
      checkExploreAnalyticsRateLimit: async (input: Record<string, unknown>) => {
        rateLimitInput = input;
        return {
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        } as never;
      },
    })
  );

  assert.equal(response.status, 201);
  assert.deepEqual(rateLimitInput, {
    scopeKey: "session:session-123",
    isAuthenticated: false,
  });
  assert.equal(insertedPayload?.event_name, "explore_swipe");
  assert.equal(insertedPayload?.market_code, "GB");
  assert.equal(insertedPayload?.trust_cue_variant, "none");
  assert.equal(insertedPayload?.trust_cue_enabled, false);
  assert.equal(insertedPayload?.cta_copy_variant, "clarity");
  assert.equal(insertedPayload?.user_id, null);
});

void test("explore analytics ingest stores authenticated user ids when available", async () => {
  let insertedPayload: Record<string, unknown> | null = null;

  const response = await postExploreAnalyticsIngestResponse(
    buildRequest(
      {
        eventName: "explore_view",
        sessionId: "session-authenticated",
      },
      { "x-explore-analytics-consent": "accepted" }
    ),
    buildDeps({
      createServerSupabaseClient: async () =>
        ({
          auth: {
            getUser: async () => ({
              data: {
                user: { id: "22222222-2222-2222-2222-222222222222" },
              },
            }),
          },
        }) as never,
      fetchUserRole: async () => "tenant",
      createServiceRoleClient: () =>
        ({
          from: () => ({
            insert: async (payload: Record<string, unknown>) => {
              insertedPayload = payload;
              return { error: null };
            },
          }),
        }) as never,
      checkExploreAnalyticsRateLimit: async (input: Record<string, unknown>) => {
        assert.deepEqual(input, {
          scopeKey: "user:22222222-2222-2222-2222-222222222222",
          isAuthenticated: true,
        });
        return {
          allowed: true,
          retryAfterSeconds: 0,
          remaining: 59,
          limit: 60,
          resetAt: Date.now() + 60_000,
        } as never;
      },
    })
  );

  assert.equal(response.status, 201);
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
          sessionId: "session-allowlist",
          listingId: "33333333-3333-4333-8333-333333333333",
          marketCode: "NG",
          intentType: "rent",
        },
        { "x-explore-analytics-consent": "accepted" }
      ),
      buildDeps({
        getExploreAnalyticsSettings: async () => ({
          enabled: true,
          consentRequired: true,
          noticeEnabled: true,
        }),
        createServiceRoleClient: () =>
          ({
            from: () => ({
              insert: async (payload: Record<string, unknown>) => {
                insertedEventNames.push(String(payload.event_name ?? ""));
                return { error: null };
              },
            }),
          }) as never,
      })
    );
    assert.equal(response.status, 201);
  }

  assert.deepEqual(insertedEventNames, exploreV2EventNames);
});
