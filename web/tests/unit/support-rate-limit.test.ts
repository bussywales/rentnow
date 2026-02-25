import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceSupportRateLimit,
  resolveSupportRateLimitScopeKey,
} from "@/lib/security/rate-limit";

function makeRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/support/escalate", {
    method: "POST",
    headers,
  });
}

void test("support rate limit scope key prefers authenticated user id", () => {
  const scope = resolveSupportRateLimitScopeKey({
    request: makeRequest({ "x-forwarded-for": "1.2.3.4" }),
    userId: "user-1",
  });
  assert.equal(scope, "user:user-1");
});

void test("support escalate anonymous requests are throttled after 5 per minute", async () => {
  const request = makeRequest({ "x-forwarded-for": "2.2.2.2" });
  const now = new Date("2026-02-24T12:00:00.000Z");

  for (let index = 0; index < 5; index += 1) {
    const result = await enforceSupportRateLimit({
      request,
      routeKey: "support_escalate",
      now,
    });
    assert.equal(result.allowed, true);
  }

  const blocked = await enforceSupportRateLimit({
    request,
    routeKey: "support_escalate",
    now,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.limit, 5);
  assert.equal(blocked.retryAfterSeconds > 0, true);
});

void test("support contact authenticated requests allow higher threshold", async () => {
  const request = makeRequest({ "x-forwarded-for": "3.3.3.3" });
  const now = new Date("2026-02-24T12:10:00.000Z");

  for (let index = 0; index < 20; index += 1) {
    const result = await enforceSupportRateLimit({
      request,
      routeKey: "support_contact",
      userId: "user-9",
      now,
    });
    assert.equal(result.allowed, true);
  }

  const blocked = await enforceSupportRateLimit({
    request,
    routeKey: "support_contact",
    userId: "user-9",
    now,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.limit, 20);
});
