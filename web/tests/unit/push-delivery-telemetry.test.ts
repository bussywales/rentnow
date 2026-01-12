import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPushDeliverySummary,
  type PushDeliveryAttemptRow,
} from "../../lib/admin/push-delivery-telemetry";

void test("push delivery telemetry summarizes outcomes", () => {
  const rows: PushDeliveryAttemptRow[] = [
    {
      id: "attempt-1",
      created_at: "2026-01-11T10:00:00.000Z",
      actor_user_id: "admin-1",
      kind: "admin_test",
      status: "attempted",
      reason_code: null,
      delivered_count: 0,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    },
    {
      id: "attempt-2",
      created_at: "2026-01-11T10:00:02.000Z",
      actor_user_id: "admin-1",
      kind: "admin_test",
      status: "delivered",
      reason_code: null,
      delivered_count: 2,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    },
    {
      id: "attempt-3",
      created_at: "2026-01-11T11:00:00.000Z",
      actor_user_id: "admin-1",
      kind: "admin_test",
      status: "skipped",
      reason_code: "no_subscriptions",
      delivered_count: 0,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 1,
    },
    {
      id: "attempt-4",
      created_at: "2026-01-11T12:00:00.000Z",
      actor_user_id: "admin-1",
      kind: "admin_test",
      status: "failed",
      reason_code: "unknown",
      delivered_count: 0,
      failed_count: 1,
      blocked_count: 0,
      skipped_count: 0,
    },
  ];

  const summary = buildPushDeliverySummary(rows);

  assert.equal(summary.attempted, 4);
  assert.equal(summary.delivered, 2);
  assert.equal(summary.blocked, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 1);
});
