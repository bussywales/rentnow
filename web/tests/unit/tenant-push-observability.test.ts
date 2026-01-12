import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "../../lib/admin/tenant-push-observability";
import type { PushDeliveryAttemptRow } from "../../lib/admin/push-delivery-telemetry";

void test("buildTotalsFromRows sums counts and derives attempted", () => {
  const rows: PushDeliveryAttemptRow[] = [
    {
      id: "row-1",
      created_at: "2026-01-10T10:00:00.000Z",
      actor_user_id: null,
      kind: "tenant_saved_search",
      status: "delivered",
      reason_code: null,
      delivered_count: 2,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    },
    {
      id: "row-2",
      created_at: "2026-01-10T11:00:00.000Z",
      actor_user_id: null,
      kind: "tenant_saved_search",
      status: "failed",
      reason_code: "timeout",
      delivered_count: 0,
      failed_count: 1,
      blocked_count: 0,
      skipped_count: 0,
    },
  ];

  const totals = __test__.buildTotalsFromRows(rows);
  assert.equal(totals.delivered, 2);
  assert.equal(totals.failed, 1);
  assert.equal(totals.attempted, 3);
});

void test("buildTopReasons labels null as none", () => {
  const rows: PushDeliveryAttemptRow[] = [
    {
      id: "row-1",
      created_at: "2026-01-10T10:00:00.000Z",
      actor_user_id: null,
      kind: "tenant_saved_search",
      status: "delivered",
      reason_code: null,
      delivered_count: 1,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    },
    {
      id: "row-2",
      created_at: "2026-01-10T11:00:00.000Z",
      actor_user_id: null,
      kind: "tenant_saved_search",
      status: "blocked",
      reason_code: "push_not_configured",
      delivered_count: 0,
      failed_count: 0,
      blocked_count: 1,
      skipped_count: 0,
    },
  ];

  const reasons = __test__.buildTopReasons(rows, 5);
  const labels = reasons.map((entry) => entry.reason);
  assert.ok(labels.includes("none"));
  assert.ok(labels.includes("push_not_configured"));
});
