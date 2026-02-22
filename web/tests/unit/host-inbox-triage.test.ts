import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTimeRemaining,
  getSlaTier,
  groupAwaitingBookings,
} from "@/lib/shortlet/host-inbox-triage";

const NOW = Date.parse("2026-02-22T10:00:00.000Z");

void test("getSlaTier applies critical/warning/ok/expired thresholds", () => {
  assert.equal(getSlaTier("2026-02-22T10:30:00.000Z", NOW), "critical");
  assert.equal(getSlaTier("2026-02-22T12:45:00.000Z", NOW), "warning");
  assert.equal(getSlaTier("2026-02-22T18:00:00.000Z", NOW), "ok");
  assert.equal(getSlaTier("2026-02-22T09:59:00.000Z", NOW), "expired");
});

void test("formatTimeRemaining produces compact host inbox labels", () => {
  assert.equal(
    formatTimeRemaining("2026-02-22T10:58:00.000Z", NOW),
    "Respond in 58m"
  );
  assert.equal(
    formatTimeRemaining("2026-02-22T12:10:00.000Z", NOW),
    "Respond in 2h 10m"
  );
  assert.equal(
    formatTimeRemaining("2026-02-22T18:00:00.000Z", NOW),
    "Respond in 8h"
  );
  assert.equal(
    formatTimeRemaining("2026-02-22T09:00:00.000Z", NOW),
    "Expired - will auto-expire"
  );
});

void test("groupAwaitingBookings separates urgent and later while preserving deadline ordering", () => {
  const grouped = groupAwaitingBookings(
    [
      {
        id: "later-a",
        respond_by: "2026-02-22T15:00:00.000Z",
        expires_at: null,
      },
      {
        id: "urgent-b",
        respond_by: "2026-02-22T10:50:00.000Z",
        expires_at: null,
      },
      {
        id: "urgent-a",
        respond_by: "2026-02-22T10:20:00.000Z",
        expires_at: null,
      },
      {
        id: "later-b",
        respond_by: "2026-02-22T18:00:00.000Z",
        expires_at: null,
      },
    ],
    NOW
  );

  assert.deepEqual(
    grouped.urgent.map((row) => row.id),
    ["urgent-a", "urgent-b"]
  );
  assert.deepEqual(
    grouped.later.map((row) => row.id),
    ["later-a", "later-b"]
  );
});

