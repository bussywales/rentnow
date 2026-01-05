import test from "node:test";
import assert from "node:assert/strict";

import { createRateLimiter } from "../../lib/messaging/rate-limit";

void test("rate limiter blocks after threshold and resets", () => {
  let now = 0;
  const limiter = createRateLimiter({
    windowSeconds: 10,
    maxSends: 2,
    nowFn: () => now,
  });

  let decision = limiter.check("sender-1");
  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 1);

  decision = limiter.check("sender-1");
  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 0);

  decision = limiter.check("sender-1");
  assert.equal(decision.allowed, false);
  assert.ok(decision.retryAfterSeconds > 0);

  now = 10000;
  decision = limiter.check("sender-1");
  assert.equal(decision.allowed, true);
});
