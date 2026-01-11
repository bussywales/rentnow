import test from "node:test";
import assert from "node:assert/strict";
import { isPrefetchRequest, shouldRecordPropertyView, shouldSkipInflightView } from "@/lib/analytics/property-views";

void test("shouldRecordPropertyView skips owner views", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const result = shouldRecordPropertyView({
    viewerId: "owner-1",
    ownerId: "owner-1",
    now,
  });

  assert.equal(result, false);
});

void test("shouldRecordPropertyView skips recent duplicates", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const lastViewedAt = new Date("2026-01-11T11:59:40Z").toISOString();
  const result = shouldRecordPropertyView({
    viewerId: "viewer-1",
    ownerId: "owner-1",
    lastViewedAt,
    now,
    dedupeSeconds: 60,
  });

  assert.equal(result, false);
});

void test("shouldRecordPropertyView allows views outside the window", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const lastViewedAt = new Date("2026-01-11T11:58:59Z").toISOString();
  const result = shouldRecordPropertyView({
    viewerId: "viewer-1",
    ownerId: "owner-1",
    lastViewedAt,
    now,
    dedupeSeconds: 60,
  });

  assert.equal(result, true);
});

void test("shouldRecordPropertyView allows anonymous views", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const result = shouldRecordPropertyView({
    viewerId: null,
    ownerId: "owner-1",
    lastViewedAt: now.toISOString(),
    now,
  });

  assert.equal(result, true);
});

void test("shouldSkipInflightView prevents rapid duplicates", () => {
  const store = new Map<string, number>();
  const nowMs = Date.now();
  const key = "prop-1:viewer-1";

  const first = shouldSkipInflightView({ key, nowMs, store, scheduleCleanup: false });
  const second = shouldSkipInflightView({ key, nowMs: nowMs + 500, store, scheduleCleanup: false });
  const later = shouldSkipInflightView({ key, nowMs: nowMs + 2500, store, scheduleCleanup: false });

  assert.equal(first, false);
  assert.equal(second, true);
  assert.equal(later, false);
});

void test("isPrefetchRequest detects prefetch headers", () => {
  const headers = {
    purpose: "prefetch",
  };
  const fallbackHeaders = {
    "x-middleware-prefetch": "1",
  };

  assert.equal(isPrefetchRequest(headers), true);
  assert.equal(isPrefetchRequest(fallbackHeaders), true);
  assert.equal(isPrefetchRequest({}), false);
});
