import test from "node:test";
import assert from "node:assert/strict";

import { buildPushTelemetrySummary } from "../../lib/admin/push-telemetry";

void test("push telemetry summary counts attempts and failures", () => {
  const summary = buildPushTelemetrySummary([
    {
      id: "a1",
      user_id: "user-1",
      property_id: "prop-1",
      channel: "email+push",
      status: "sent",
      error: null,
    },
    {
      id: "a2",
      user_id: "user-2",
      property_id: "prop-2",
      channel: "email+push",
      status: "failed",
      error: "push_failed:rate_limited",
    },
    {
      id: "a3",
      user_id: "user-3",
      property_id: "prop-3",
      channel: "email",
      status: "sent",
      error: null,
    },
    {
      id: "a4",
      user_id: "user-4",
      property_id: "prop-4",
      channel: "push",
      status: "skipped",
      error: "push_unavailable:missing_subscription",
    },
  ]);

  assert.equal(summary.sampleSize, 4);
  assert.equal(summary.pushAttempted, 3);
  assert.equal(summary.pushSucceeded, 1);
  assert.equal(summary.topFailureReasons[0]?.reason, "push_failed:rate_limited");
  assert.equal(summary.topFailureReasons[1]?.reason, "push_unavailable:missing_subscription");
});
