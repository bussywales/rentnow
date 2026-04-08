import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceSharedRateLimit,
  resetSharedRateLimitForTests,
} from "@/lib/security/shared-rate-limit";

void test("shared rate limit uses db path when client succeeds", async () => {
  const rows = [{ created_at: "2026-04-08T12:00:00.000Z" }];
  let inserted = false;
  const client = {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        order: () => query,
        range: () =>
          Promise.resolve({
            data: rows,
            error: null,
          }),
        insert: () => {
          inserted = true;
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  };

  const result = await enforceSharedRateLimit({
    client,
    routeKey: "test_route",
    scopeKey: "user:123",
    isAuthenticated: true,
    windowSeconds: 60,
    maxRequests: 3,
    now: new Date("2026-04-08T12:00:30.000Z"),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.source, "db");
  assert.equal(inserted, true);
});

void test("shared rate limit falls back to memory when db path fails", async () => {
  resetSharedRateLimitForTests();
  const failingClient = {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        order: () => query,
        range: () =>
          Promise.resolve({
            data: null,
            error: { message: "db offline" },
          }),
        insert: () => Promise.resolve({ error: { message: "db offline" } }),
      };
      return query;
    },
  };

  const first = await enforceSharedRateLimit({
    client: failingClient,
    routeKey: "test_route",
    scopeKey: "user:456",
    isAuthenticated: true,
    windowSeconds: 60,
    maxRequests: 1,
    now: 1_000,
  });
  const second = await enforceSharedRateLimit({
    client: failingClient,
    routeKey: "test_route",
    scopeKey: "user:456",
    isAuthenticated: true,
    windowSeconds: 60,
    maxRequests: 1,
    now: 1_001,
  });

  assert.equal(first.allowed, true);
  assert.equal(first.source, "memory");
  assert.equal(second.allowed, false);
  assert.equal(second.source, "memory");
});
