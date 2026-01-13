import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "../../lib/tenant/push-diagnostics";

void test("buildTotalsFromRows sums delivered and failed counts", () => {
  const totals = __test__.buildTotalsFromRows([
    {
      status: "delivered",
      delivered_count: 2,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    },
    {
      status: "failed",
      delivered_count: 0,
      failed_count: 1,
      blocked_count: 0,
      skipped_count: 0,
    },
  ]);

  assert.equal(totals.attempted, 3);
  assert.equal(totals.delivered, 2);
  assert.equal(totals.failed, 1);
});

void test("buildTopReasons groups reason counts", () => {
  const top = __test__.buildTopReasons(
    [
      { reason_code: "deduped" },
      { reason_code: "deduped" },
      { reason_code: "not_configured" },
      { reason_code: null },
    ],
    5
  );

  assert.equal(top[0].reason, "deduped");
  assert.equal(top[0].count, 2);
  assert.ok(top.find((row) => row.reason === "not_configured"));
  assert.ok(top.find((row) => row.reason === "none"));
});
