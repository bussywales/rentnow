import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPushFailed,
  formatPushPruned,
  formatPushUnavailable,
  getPushOutcomeMarker,
} from "../../lib/push/outcomes";

void test("push outcomes mark unavailable when missing subscription", () => {
  const marker = getPushOutcomeMarker({
    attempted: false,
    status: "skipped",
    error: formatPushUnavailable("missing_subscription"),
  });
  assert.equal(marker, "push_unavailable:missing_subscription");
});

void test("push outcomes mark unavailable when not configured", () => {
  const marker = getPushOutcomeMarker({
    attempted: false,
    status: "skipped",
    error: formatPushUnavailable("not_configured"),
  });
  assert.equal(marker, "push_unavailable:not_configured");
});

void test("push outcomes mark success as push_sent", () => {
  const marker = getPushOutcomeMarker({
    attempted: true,
    status: "sent",
  });
  assert.equal(marker, "push_sent");
});

void test("push outcomes preserve failure markers", () => {
  const marker = getPushOutcomeMarker({
    attempted: true,
    status: "failed",
    error: formatPushFailed("rate_limited"),
  });
  assert.equal(marker, "push_failed:rate_limited");
});

void test("push outcomes format prune markers", () => {
  assert.equal(formatPushPruned("gone"), "push_pruned:gone");
});
