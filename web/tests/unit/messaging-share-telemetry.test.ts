import test from "node:test";
import assert from "node:assert/strict";

import { buildShareTelemetrySummary } from "../../lib/admin/message-share-telemetry";

void test("buildShareTelemetrySummary counts active, expired, and revoked links", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const rows = [
    { id: "active", expires_at: "2026-01-02T00:00:00Z", revoked_at: null },
    { id: "expired", expires_at: "2025-12-31T10:00:00Z", revoked_at: null },
    { id: "revoked", expires_at: "2026-01-02T00:00:00Z", revoked_at: "2025-12-31T08:00:00Z" },
  ];

  const summary = buildShareTelemetrySummary(rows, now);

  assert.equal(summary.statusCounts.active, 1);
  assert.equal(summary.statusCounts.expired, 1);
  assert.equal(summary.statusCounts.revoked, 1);
  assert.equal(summary.statusCounts.invalid, 0);
  assert.equal(summary.invalidTracked, false);
});
