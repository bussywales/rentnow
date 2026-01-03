import test from "node:test";
import assert from "node:assert/strict";

import { isReplayAlreadyProcessed, resolveReplayMode } from "../../lib/billing/stripe-replay";

void test("resolveReplayMode prefers stored mode over provider mode", () => {
  assert.equal(resolveReplayMode("live", "test"), "live");
  assert.equal(resolveReplayMode("test", "live"), "test");
});

void test("resolveReplayMode falls back to provider mode when stored mode missing", () => {
  assert.equal(resolveReplayMode(null, "live"), "live");
  assert.equal(resolveReplayMode(undefined, "test"), "test");
  assert.equal(resolveReplayMode("unknown", "test"), "test");
});

void test("isReplayAlreadyProcessed requires processed status and timestamp", () => {
  assert.equal(isReplayAlreadyProcessed({ status: "processed", processed_at: "2026-01-01T00:00:00.000Z" }), true);
  assert.equal(isReplayAlreadyProcessed({ status: "processed", processed_at: null }), false);
  assert.equal(isReplayAlreadyProcessed({ status: "ignored", processed_at: "2026-01-01T00:00:00.000Z" }), false);
});
