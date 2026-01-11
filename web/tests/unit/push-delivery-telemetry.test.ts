import test from "node:test";
import assert from "node:assert/strict";

import {
  recordPushDeliveryAttempt,
  getPushDeliverySummary,
  resetPushDeliveryTelemetry,
} from "../../lib/push/delivery-telemetry";

void test("push delivery telemetry summarizes outcomes", () => {
  resetPushDeliveryTelemetry();

  recordPushDeliveryAttempt({
    outcome: "delivered",
    reason: "send_succeeded",
    attempted: 2,
    delivered: 2,
    createdAt: "2026-01-11T10:00:00.000Z",
  });
  recordPushDeliveryAttempt({
    outcome: "skipped",
    reason: "no_subscriptions",
    attempted: 0,
    delivered: 0,
    createdAt: "2026-01-11T11:00:00.000Z",
  });
  recordPushDeliveryAttempt({
    outcome: "failed",
    reason: "send_failed",
    attempted: 1,
    delivered: 0,
    createdAt: "2026-01-11T12:00:00.000Z",
  });

  const summary = getPushDeliverySummary(20);

  assert.equal(summary.attempted, 3);
  assert.equal(summary.delivered, 2);
  assert.equal(summary.blocked, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 1);
});
